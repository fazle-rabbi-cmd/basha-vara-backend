import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateVisitRequestDto,
  UpdateVisitRequestDto,
  UpdateVisitStatusDto,
  AcceptSlotDto,
  DeclineVisitDto,
  ProposeRescheduleDto,
  RespondRescheduleDto,
  CancelVisitDto,
  SetPropertyAvailabilityDto,
  VerifyCheckInDto,
  ConfirmVideoCallDto,
  ReportLandlordNoShowDto,
} from './dto/index.js';
import { VisitStatus, NotificationType, UserStatus, Prisma, VerificationBadgeType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationEmailQueueService } from '../email/notification-email-queue.service.js';
import { NotificationDigestService } from '../email/notification-digest.service.js';
import { OtpService } from '../common/services/otp.service.js';
import { WorkflowAuditService } from '../common/services/workflow-audit.service.js';
import { IcsGeneratorService } from './services/ics-generator.service.js';
import { WORKFLOW_CONFIG } from '../config/workflow.config.js';
import { DomainVisitStatus, normalizeVisitStatus } from './domain/visit-status.enum.js';
import { VisitStateMachine, ActorRole } from './domain/visit-state-machine.js';
import { VisitPolicy } from './domain/visit-policy.js';
import { ProposedSlot, ConfirmedSlot, RescheduleProposal } from './domain/visit.types.js';
import { OtpHasher } from './domain/otp-hasher.js';
import { VerificationPolicy } from './domain/verification-policy.js';
import { VisitReminderWorker } from './visit-reminder.worker.js';
import { VisitAutoExpireWorker } from './visit-auto-expire.worker.js';
import { TokenHoldWorker } from './token-hold.worker.js';

@Injectable()
export class VisitsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private emailQueueService: NotificationEmailQueueService,
    private digestService: NotificationDigestService,
    private otpService: OtpService,
    private auditService: WorkflowAuditService,
    private icsGenerator: IcsGeneratorService,
    private visitReminderWorker: VisitReminderWorker,
    private visitAutoExpireWorker: VisitAutoExpireWorker,
    private tokenHoldWorker: TokenHoldWorker,
  ) {}

  private resolveActorRole(
    userId: string,
    visit: { tenantId: string; property: { landlordId: string } },
    roles: string[] = [],
  ): ActorRole {
    if (roles.includes('ADMIN') || roles.includes('SUPER_ADMIN')) {
      return 'ADMIN';
    }
    if (visit.property.landlordId === userId) {
      return 'LANDLORD';
    }
    if (visit.tenantId === userId) {
      return 'TENANT';
    }
    throw new ForbiddenException('You do not have permission to modify this visit request');
  }

  private checkStateTransition(
    from: DomainVisitStatus,
    to: DomainVisitStatus,
    actorRole: ActorRole,
  ): void {
    try {
      VisitStateMachine.assertCanTransition(from, to, actorRole);
    } catch (err: any) {
      if (err.message && err.message.includes('not authorized')) {
        throw new ForbiddenException(err.message);
      }
      throw new BadRequestException(err.message);
    }
  }

  // ==========================================
  // CREATE VISIT REQUEST (PHASE 1)
  // ==========================================
  async create(propertyId: string, tenantId: string, dto: CreateVisitRequestDto) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    // Check if property is locked by another visit
    if (property.lockedByVisitId && property.lockedUntil && new Date() < property.lockedUntil) {
      const lockedVisit = await this.prisma.visitRequest.findUnique({
        where: { id: property.lockedByVisitId },
        select: { tenantId: true },
      });

      if (lockedVisit && lockedVisit.tenantId !== tenantId) {
        throw new BadRequestException('This property is currently locked by another tenant\'s token hold. Please try again later.');
      }
    }

    if (property.landlordId === tenantId) {
      throw new BadRequestException('You cannot request a visit to your own property');
    }

    // Verify tenant exists and is active with verified phone or email
    const tenant = await this.prisma.user.findUnique({
      where: { id: tenantId },
      select: { id: true, fullName: true, email: true, phone: true, status: true },
    });

    if (!tenant || tenant.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account is not active or authorized to schedule visits.');
    }

    if (!tenant.email && !tenant.phone && !dto.contactPhone) {
      throw new BadRequestException('Tenant must have a registered email or phone to schedule visits.');
    }

    // Parse candidate slots (either proposedSlots array or fallback requestedDate + requestedTime)
    let candidateSlots: ProposedSlot[] = [];
    if (dto.proposedSlots && Array.isArray(dto.proposedSlots) && dto.proposedSlots.length > 0) {
      candidateSlots = dto.proposedSlots.map((s, idx) => ({
        date: s.date,
        time: s.time,
        slotIndex: s.slotIndex !== undefined ? s.slotIndex : idx,
      }));
    } else if (dto.requestedDate && dto.requestedTime) {
      const dStr = dto.requestedDate instanceof Date
        ? dto.requestedDate.toISOString().split('T')[0]
        : String(dto.requestedDate).split('T')[0];
      candidateSlots = [{ date: dStr, time: dto.requestedTime.trim(), slotIndex: 0 }];
    } else {
      throw new BadRequestException('At least one candidate visit slot (date and time) must be provided.');
    }

    // Validate proposed slots using VisitPolicy
    try {
      VisitPolicy.validateProposedSlots(
        candidateSlots,
        WORKFLOW_CONFIG.visit.maxProposedSlots,
        new Date(),
      );
    } catch (validationErr: any) {
      throw new BadRequestException(validationErr.message);
    }

    // Check active requests limit on this listing (max 1 active per tenant per listing)
    const activeRequestsOnListing = await this.prisma.visitRequest.count({
      where: {
        propertyId,
        tenantId,
        status: {
          in: [
            VisitStatus.REQUESTED,
            VisitStatus.PENDING,
            VisitStatus.CONFIRMED,
            VisitStatus.ACCEPTED,
            VisitStatus.RESCHEDULE_PROPOSED,
          ],
        },
      },
    });

    if (VisitPolicy.hasActiveRequestOnListing(activeRequestsOnListing, 1)) {
      throw new BadRequestException('You already have an active visit request for this property.');
    }

    // Check daily quota (max 5 new requests per tenant per 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyRequestsCount = await this.prisma.visitRequest.count({
      where: {
        tenantId,
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    if (VisitPolicy.isDailyQuotaExceeded(dailyRequestsCount, WORKFLOW_CONFIG.visit.maxNewRequestsPerTenantPerDay)) {
      throw new BadRequestException(
        `Daily visit request quota reached (maximum ${WORKFLOW_CONFIG.visit.maxNewRequestsPerTenantPerDay} requests per 24 hours).`,
      );
    }

    const finalGuestCount = dto.guestCount !== undefined ? dto.guestCount : 1;
    const primarySlot = candidateSlots[0];
    const primaryDateTime = VisitPolicy.parseSlotDateTime(primarySlot.date, primarySlot.time);

    const visit = await this.prisma.visitRequest.create({
      data: {
        propertyId,
        tenantId,
        requestedDate: primaryDateTime,
        requestedTime: primarySlot.time,
        proposedSlots: candidateSlots as any,
        message: dto.message?.trim() || null,
        visitType: dto.visitType || 'IN_PERSON',
        guestCount: finalGuestCount,
        contactPhone: dto.contactPhone?.trim() || tenant.phone || null,
        status: VisitStatus.REQUESTED,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
            rentAmount: true,
            photos: { take: 1 },
            landlordId: true,
          },
        },
      },
    });

    // Write append-only audit event
    await this.auditService.logTransition({
      entity: 'VISIT',
      entityId: visit.id,
      fromStatus: null,
      toStatus: DomainVisitStatus.REQUESTED,
      actorId: tenantId,
      actorRole: 'TENANT',
      reason: 'Tenant requested property inspection visit',
      metadata: { proposedSlots: candidateSlots, visitType: visit.visitType },
    });

    // Notify landlord in-app
    try {
      await this.notificationsService.create(
        property.landlordId,
        NotificationType.VISIT_REQUESTED,
        'New Visit Request',
        `A tenant has requested to visit your property: ${property.title}`,
        { visitId: visit.id, propertyId, tenantId },
      );

      // Queue landlord email digest
      await this.digestService.queueForDigest(
        property.landlordId,
        'NEW_VISIT_REQUEST',
        {
          propertyTitle: property.title,
          tenantName: tenant.fullName || 'A tenant',
          visitDate: primarySlot.date,
          visitTime: primarySlot.time,
          propertyId,
          visitId: visit.id,
        },
      );
    } catch (notifyErr) {
      console.error('Non-critical notification error during visit creation:', notifyErr);
    }

    try {
      await this.visitAutoExpireWorker.scheduleSingleExpire(visit.id);
    } catch (expireErr) {
      console.error('Non-critical auto-expire scheduling error during visit creation:', expireErr);
    }

    return visit;
  }

  // ==========================================
  // ACCEPT SLOT / CONFIRM VISIT (PHASE 1)
  // ==========================================
  async acceptSlot(visitId: string, userId: string, roles: string[] = [], dto: AcceptSlotDto) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true, tenant: true },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const actorRole = this.resolveActorRole(userId, visit, roles);
    const currentDomainStatus = normalizeVisitStatus(visit.status);

    this.checkStateTransition(currentDomainStatus, DomainVisitStatus.CONFIRMED, actorRole);

    // Identify which slot is being accepted
    let slotToConfirm: ConfirmedSlot | null = null;
    const proposedSlots = (visit.proposedSlots as unknown as ProposedSlot[]) || [];

    if (dto.slotIndex !== undefined && proposedSlots[dto.slotIndex]) {
      const ps = proposedSlots[dto.slotIndex];
      slotToConfirm = { date: ps.date, time: ps.time };
    } else if (dto.confirmedDate && dto.confirmedTime) {
      slotToConfirm = { date: dto.confirmedDate.trim(), time: dto.confirmedTime.trim() };
    } else if (proposedSlots.length > 0) {
      slotToConfirm = { date: proposedSlots[0].date, time: proposedSlots[0].time };
    } else {
      const dStr = visit.requestedDate.toISOString().split('T')[0];
      slotToConfirm = { date: dStr, time: visit.requestedTime };
    }

    const confirmedDateTime = VisitPolicy.parseSlotDateTime(slotToConfirm.date, slotToConfirm.time);
    if (isNaN(confirmedDateTime.getTime())) {
      throw new BadRequestException('Invalid date or time for confirmed slot.');
    }
    if (confirmedDateTime.getTime() <= Date.now()) {
      throw new BadRequestException('Confirmed visit slot must be scheduled in the future.');
    }

    // Execute state change & calendar conflict check inside transaction
    const updatedVisit = await this.prisma.$transaction(async (tx) => {
      // 1. Conflict check on the listing
      const existingListingVisits = await tx.visitRequest.findMany({
        where: {
          propertyId: visit.propertyId,
          id: { not: visitId },
          status: { in: [VisitStatus.CONFIRMED, VisitStatus.ACCEPTED] },
        },
        select: { id: true, confirmedSlot: true, requestedDate: true, requestedTime: true },
      });

      for (const elv of existingListingVisits) {
        let exSlot: { date: string | Date; time: string } | null = null;
        if (elv.confirmedSlot && typeof elv.confirmedSlot === 'object') {
          const cs = elv.confirmedSlot as any;
          if (cs.date && cs.time) exSlot = { date: cs.date, time: cs.time };
        }
        if (!exSlot && elv.requestedDate && elv.requestedTime) {
          exSlot = { date: elv.requestedDate, time: elv.requestedTime };
        }
        if (exSlot && VisitPolicy.doSlotsOverlap(slotToConfirm!, exSlot, WORKFLOW_CONFIG.visit.defaultSlotDurationMinutes)) {
          throw new BadRequestException(
            'Double-booking detected: Another confirmed visit overlaps this time window on this property.',
          );
        }
      }

      // 2. Conflict check on Landlord calendar across all properties
      const existingLandlordVisits = await tx.visitRequest.findMany({
        where: {
          property: { landlordId: visit.property.landlordId },
          id: { not: visitId },
          status: { in: [VisitStatus.CONFIRMED, VisitStatus.ACCEPTED] },
        },
        select: { id: true, confirmedSlot: true, requestedDate: true, requestedTime: true },
      });

      for (const elv of existingLandlordVisits) {
        let exSlot: { date: string | Date; time: string } | null = null;
        if (elv.confirmedSlot && typeof elv.confirmedSlot === 'object') {
          const cs = elv.confirmedSlot as any;
          if (cs.date && cs.time) exSlot = { date: cs.date, time: cs.time };
        }
        if (!exSlot && elv.requestedDate && elv.requestedTime) {
          exSlot = { date: elv.requestedDate, time: elv.requestedTime };
        }
        if (exSlot && VisitPolicy.doSlotsOverlap(slotToConfirm!, exSlot, WORKFLOW_CONFIG.visit.defaultSlotDurationMinutes)) {
          throw new BadRequestException(
            'Landlord calendar conflict: Landlord has another confirmed visit overlapping this time window.',
          );
        }
      }

      // 3. Generate verification keys and cryptographically hashed OTP
      const otpSalt = OtpHasher.generateSalt();
      const rawTenantOtp = OtpHasher.generateNumericOtp(WORKFLOW_CONFIG.verification.otpLength);
      const tenantOtpHashed = OtpHasher.hashOtp(rawTenantOtp, otpSalt);

      const tenantOtpKey = `${visitId}-tenant`;
      const landlordOtpKey = `${visitId}-landlord`;
      const legacyTenantOtp = this.otpService.generateOtp(tenantOtpKey) || rawTenantOtp;
      const legacyLandlordOtp = this.otpService.generateOtp(landlordOtpKey) || Math.floor(100000 + Math.random() * 900000).toString();

      return tx.visitRequest.update({
        where: { id: visitId },
        data: {
          status: VisitStatus.CONFIRMED,
          confirmedSlot: slotToConfirm as any,
          requestedDate: confirmedDateTime,
          requestedTime: slotToConfirm!.time,
          tenantOtp: visit.tenantOtp || rawTenantOtp,
          landlordOtp: visit.landlordOtp || legacyLandlordOtp,
          tenantOtpHashed,
          otpSalt,
          verificationFailedAttempts: 0,
        },
        include: {
          property: {
            select: { id: true, title: true, area: true, city: true, addressLine: true, landlordId: true },
          },
          tenant: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
      });
    });

    // Write audit event
    await this.auditService.logTransition({
      entity: 'VISIT',
      entityId: visit.id,
      fromStatus: currentDomainStatus,
      toStatus: DomainVisitStatus.CONFIRMED,
      actorId: userId,
      actorRole,
      reason: 'Landlord confirmed visit slot',
      metadata: { confirmedSlot: slotToConfirm },
    });

    // Notify tenant
    try {
      await this.notificationsService.create(
        visit.tenantId,
        NotificationType.VISIT_ACCEPTED,
        'Visit Confirmed',
        `Your visit for ${updatedVisit.property.title} is confirmed for ${slotToConfirm.date} at ${slotToConfirm.time}.`,
        { visitId, propertyId: visit.propertyId },
      );

      await this.emailQueueService.queueNotificationEmail(
        visit.tenantId,
        'VISIT_ACCEPTED' as any,
        {
          propertyTitle: updatedVisit.property.title,
          visitDate: slotToConfirm.date,
          visitTime: slotToConfirm.time,
          propertyId: visit.propertyId,
          visitId,
        },
      );
    } catch (notifyErr) {
      console.error('Non-critical notification error on accept slot:', notifyErr);
    }

    try {
      await this.visitReminderWorker.scheduleReminders(visitId);
    } catch (reminderErr) {
      console.error('Non-critical reminder scheduling error on accept slot:', reminderErr);
    }

    return updatedVisit;
  }

  // ==========================================
  // DECLINE VISIT (PHASE 1)
  // ==========================================
  async declineVisit(visitId: string, userId: string, roles: string[] = [], dto: DeclineVisitDto) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const actorRole = this.resolveActorRole(userId, visit, roles);
    const currentDomainStatus = normalizeVisitStatus(visit.status);

    this.checkStateTransition(currentDomainStatus, DomainVisitStatus.DECLINED, actorRole);

    const updatedVisit = await this.prisma.visitRequest.update({
      where: { id: visitId },
      data: {
        status: VisitStatus.DECLINED,
        declineReasonCode: dto.reasonCode,
        declineReason: dto.reason?.trim() || null,
      },
      include: {
        property: { select: { id: true, title: true, area: true } },
        tenant: { select: { id: true, fullName: true, email: true } },
      },
    });

    // Process token hold refund if exists (full refund for landlord-side decline)
    if (visit.tokenHoldAmount) {
      try {
        await this.tokenHoldWorker.handleLandlordSideCancellation(visitId, 'LANDLORD_DECLINED');
      } catch (refundErr) {
        console.error('Non-critical token hold refund error on decline:', refundErr);
      }
    }

    await this.auditService.logTransition({
      entity: 'VISIT',
      entityId: visit.id,
      fromStatus: currentDomainStatus,
      toStatus: DomainVisitStatus.DECLINED,
      actorId: userId,
      actorRole,
      reason: dto.reasonCode,
      metadata: { reasonCode: dto.reasonCode, reasonText: dto.reason },
    });

    try {
      await this.notificationsService.create(
        visit.tenantId,
        NotificationType.VISIT_DECLINED,
        'Visit Request Declined',
        `Your visit request for ${updatedVisit.property.title} was declined (${dto.reasonCode}).`,
        { visitId, propertyId: visit.propertyId },
      );
    } catch (notifyErr) {
      console.error('Non-critical notification error on decline:', notifyErr);
    }

    return updatedVisit;
  }

  // ==========================================
  // PROPOSE RESCHEDULE (PHASE 1)
  // ==========================================
  async proposeReschedule(
    visitId: string,
    userId: string,
    roles: string[] = [],
    dto: ProposeRescheduleDto,
  ) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const actorRole = this.resolveActorRole(userId, visit, roles);
    const currentDomainStatus = normalizeVisitStatus(visit.status);

    this.checkStateTransition(
      currentDomainStatus,
      DomainVisitStatus.RESCHEDULE_PROPOSED,
      actorRole,
    );

    const newSlotDateTime = VisitPolicy.parseSlotDateTime(dto.date, dto.time);
    if (isNaN(newSlotDateTime.getTime()) || newSlotDateTime.getTime() <= Date.now()) {
      throw new BadRequestException('Reschedule proposed time must be in the future.');
    }

    const proposal: RescheduleProposal = {
      date: dto.date.trim(),
      time: dto.time.trim(),
      proposedBy: actorRole,
      proposedAt: new Date().toISOString(),
      reason: dto.reason?.trim() || undefined,
    };

    const updatedVisit = await this.prisma.visitRequest.update({
      where: { id: visitId },
      data: {
        status: VisitStatus.RESCHEDULE_PROPOSED,
        rescheduleSlot: proposal as any,
      },
      include: {
        property: { select: { id: true, title: true, landlordId: true } },
        tenant: { select: { id: true, fullName: true } },
      },
    });

    await this.auditService.logTransition({
      entity: 'VISIT',
      entityId: visit.id,
      fromStatus: currentDomainStatus,
      toStatus: DomainVisitStatus.RESCHEDULE_PROPOSED,
      actorId: userId,
      actorRole,
      reason: dto.reason || 'Reschedule proposed',
      metadata: { proposal },
    });

    const recipientId = actorRole === 'TENANT' ? visit.property.landlordId : visit.tenantId;
    try {
      await this.notificationsService.create(
        recipientId,
        NotificationType.VISIT_REQUESTED,
        'Visit Reschedule Proposed',
        `A new visit time was proposed for ${updatedVisit.property.title}: ${dto.date} at ${dto.time}.`,
        { visitId, propertyId: visit.propertyId },
      );
    } catch (notifyErr) {
      console.error('Non-critical notification error on reschedule proposal:', notifyErr);
    }

    return updatedVisit;
  }

  // ==========================================
  // RESPOND TO RESCHEDULE (PHASE 1)
  // ==========================================
  async respondReschedule(
    visitId: string,
    userId: string,
    roles: string[] = [],
    dto: RespondRescheduleDto,
  ) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true, tenant: true },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const actorRole = this.resolveActorRole(userId, visit, roles);
    const currentDomainStatus = normalizeVisitStatus(visit.status);

    if (currentDomainStatus !== DomainVisitStatus.RESCHEDULE_PROPOSED) {
      throw new BadRequestException('Visit does not have an active reschedule proposal awaiting response.');
    }

    const proposal = visit.rescheduleSlot as unknown as RescheduleProposal;
    if (!proposal || !proposal.date || !proposal.time) {
      throw new BadRequestException('No valid reschedule proposal found on this visit request.');
    }

    if (dto.accept) {
      this.checkStateTransition(currentDomainStatus, DomainVisitStatus.CONFIRMED, actorRole);

      const confirmedSlot: ConfirmedSlot = { date: proposal.date, time: proposal.time };
      const confirmedDateTime = VisitPolicy.parseSlotDateTime(confirmedSlot.date, confirmedSlot.time);

      const updatedVisit = await this.prisma.$transaction(async (tx) => {
        // Double-booking check on listing
        const existingListingVisits = await tx.visitRequest.findMany({
          where: {
            propertyId: visit.propertyId,
            id: { not: visitId },
            status: { in: [VisitStatus.CONFIRMED, VisitStatus.ACCEPTED] },
          },
          select: { id: true, confirmedSlot: true, requestedDate: true, requestedTime: true },
        });

        for (const elv of existingListingVisits) {
          let exSlot: { date: string | Date; time: string } | null = null;
          if (elv.confirmedSlot && typeof elv.confirmedSlot === 'object') {
            const cs = elv.confirmedSlot as any;
            if (cs.date && cs.time) exSlot = { date: cs.date, time: cs.time };
          }
          if (!exSlot && elv.requestedDate && elv.requestedTime) {
            exSlot = { date: elv.requestedDate, time: elv.requestedTime };
          }
          if (exSlot && VisitPolicy.doSlotsOverlap(confirmedSlot, exSlot, WORKFLOW_CONFIG.visit.defaultSlotDurationMinutes)) {
            throw new BadRequestException(
              'Double booking detected: There is an overlapping confirmed visit for this time.',
            );
          }
        }

        const otpSalt = OtpHasher.generateSalt();
        const rawTenantOtp = OtpHasher.generateNumericOtp(WORKFLOW_CONFIG.verification.otpLength);
        const tenantOtpHashed = OtpHasher.hashOtp(rawTenantOtp, otpSalt);

        return tx.visitRequest.update({
          where: { id: visitId },
          data: {
            status: VisitStatus.CONFIRMED,
            confirmedSlot: confirmedSlot as any,
            requestedDate: confirmedDateTime,
            requestedTime: confirmedSlot.time,
            rescheduleSlot: Prisma.JsonNull,
            tenantOtp: rawTenantOtp,
            tenantOtpHashed,
            otpSalt,
            verificationFailedAttempts: 0,
          },
          include: { property: true, tenant: true },
        });
      });

      await this.auditService.logTransition({
        entity: 'VISIT',
        entityId: visit.id,
        fromStatus: currentDomainStatus,
        toStatus: DomainVisitStatus.CONFIRMED,
        actorId: userId,
        actorRole,
        reason: 'Reschedule proposal accepted',
        metadata: { confirmedSlot },
      });

      const recipientId = actorRole === 'TENANT' ? visit.property.landlordId : visit.tenantId;
      try {
        await this.notificationsService.create(
          recipientId,
          NotificationType.VISIT_ACCEPTED,
          'Reschedule Confirmed',
          `The proposed reschedule for ${visit.property.title} was accepted.`,
          { visitId, propertyId: visit.propertyId },
        );
      } catch (notifyErr) {
        console.error('Non-critical notification error on reschedule accepted:', notifyErr);
      }

      return updatedVisit;
    } else {
      // Declined reschedule proposal
      this.checkStateTransition(currentDomainStatus, DomainVisitStatus.DECLINED, actorRole);

      const updatedVisit = await this.prisma.visitRequest.update({
        where: { id: visitId },
        data: {
          status: VisitStatus.DECLINED,
          declineReason: dto.declineReason || 'Reschedule proposal declined by counterpart',
          rescheduleSlot: Prisma.JsonNull,
        },
        include: { property: true, tenant: true },
      });

      await this.auditService.logTransition({
        entity: 'VISIT',
        entityId: visit.id,
        fromStatus: currentDomainStatus,
        toStatus: DomainVisitStatus.DECLINED,
        actorId: userId,
        actorRole,
        reason: dto.declineReason || 'Reschedule proposal declined',
      });

      const recipientId = actorRole === 'TENANT' ? visit.property.landlordId : visit.tenantId;
      try {
        await this.notificationsService.create(
          recipientId,
          NotificationType.VISIT_DECLINED,
          'Reschedule Declined',
          `The reschedule proposal for ${visit.property.title} was declined.`,
          { visitId, propertyId: visit.propertyId },
        );
      } catch (notifyErr) {
        console.error('Non-critical notification error on reschedule declined:', notifyErr);
      }

      return updatedVisit;
    }
  }

  // ==========================================
  // CANCEL VISIT (PHASE 1)
  // ==========================================
  async cancelVisit(visitId: string, userId: string, roles: string[] = [], dto: CancelVisitDto = {}) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true, tenant: true },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const actorRole = this.resolveActorRole(userId, visit, roles);
    const currentDomainStatus = normalizeVisitStatus(visit.status);

    this.checkStateTransition(currentDomainStatus, DomainVisitStatus.CANCELLED, actorRole);

    // If already CONFIRMED, enforce cancellation cutoff window (2 hours)
    if (currentDomainStatus === DomainVisitStatus.CONFIRMED && actorRole !== 'ADMIN') {
      let slotDate: string | Date = visit.requestedDate;
      let slotTime = visit.requestedTime;

      if (visit.confirmedSlot && typeof visit.confirmedSlot === 'object') {
        const cs = visit.confirmedSlot as any;
        if (cs.date && cs.time) {
          slotDate = cs.date;
          slotTime = cs.time;
        }
      }

      const isBlocked = VisitPolicy.isBlockedByCutoff(
        slotDate,
        slotTime,
        WORKFLOW_CONFIG.visit.cancelCutoffHours,
        new Date(),
      );

      if (isBlocked) {
        throw new BadRequestException(
          `Confirmed visits cannot be cancelled less than ${WORKFLOW_CONFIG.visit.cancelCutoffHours} hours before the scheduled time.`,
        );
      }
    }

    const updatedVisit = await this.prisma.visitRequest.update({
      where: { id: visitId },
      data: {
        status: VisitStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancelReason: dto.reason?.trim() || null,
      },
      include: { property: true, tenant: true },
    });

    // Process token hold refund if tenant walks away
    if (visit.tokenHoldAmount && actorRole === 'TENANT') {
      try {
        await this.tokenHoldWorker.handleTenantWalkaway(visitId);
      } catch (refundErr) {
        console.error('Non-critical token hold refund error on tenant cancel:', refundErr);
      }
    }

    await this.auditService.logTransition({
      entity: 'VISIT',
      entityId: visit.id,
      fromStatus: currentDomainStatus,
      toStatus: DomainVisitStatus.CANCELLED,
      actorId: userId,
      actorRole,
      reason: dto.reason || 'Visit cancelled by participant',
    });

    const recipientId = actorRole === 'TENANT' ? visit.property.landlordId : visit.tenantId;
    try {
      await this.notificationsService.create(
        recipientId,
        NotificationType.VISIT_CANCELLED,
        'Visit Cancelled',
        `The visit for ${updatedVisit.property.title} was cancelled.`,
        { visitId, propertyId: visit.propertyId },
      );
    } catch (notifyErr) {
      console.error('Non-critical notification error on cancel:', notifyErr);
    }

    return updatedVisit;
  }

  // ==========================================
  // REPORT NO SHOW (PHASE 1)
  // ==========================================
  async reportNoShow(visitId: string, userId: string, roles: string[] = []) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true, tenant: true },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const actorRole = this.resolveActorRole(userId, visit, roles);
    const currentDomainStatus = normalizeVisitStatus(visit.status);

    this.checkStateTransition(currentDomainStatus, DomainVisitStatus.NO_SHOW, actorRole);

    // Verify scheduled window has passed
    let slotDate: string | Date = visit.requestedDate;
    let slotTime = visit.requestedTime;
    if (visit.confirmedSlot && typeof visit.confirmedSlot === 'object') {
      const cs = visit.confirmedSlot as any;
      if (cs.date && cs.time) {
        slotDate = cs.date;
        slotTime = cs.time;
      }
    }

    const scheduledStart = VisitPolicy.parseSlotDateTime(slotDate, slotTime);
    const windowEnd = new Date(scheduledStart.getTime() + WORKFLOW_CONFIG.visit.defaultSlotDurationMinutes * 60 * 1000);

    if (Date.now() < windowEnd.getTime() && actorRole !== 'ADMIN') {
      throw new BadRequestException('Cannot report a no-show before the scheduled visit window has concluded.');
    }

    const updatedVisit = await this.prisma.visitRequest.update({
      where: { id: visitId },
      data: {
        status: VisitStatus.NO_SHOW,
        noShowReportedAt: new Date(),
        noShowReportedBy: userId,
      },
      include: { property: true, tenant: true },
    });

    await this.auditService.logTransition({
      entity: 'VISIT',
      entityId: visit.id,
      fromStatus: currentDomainStatus,
      toStatus: DomainVisitStatus.NO_SHOW,
      actorId: userId,
      actorRole,
      reason: 'Landlord reported tenant no-show after scheduled window',
    });

    try {
      await this.notificationsService.create(
        visit.tenantId,
        NotificationType.VISIT_CANCELLED,
        'Visit Marked as No-Show',
        `Your visit for ${updatedVisit.property.title} was reported as a no-show.`,
        { visitId, propertyId: visit.propertyId },
      );
    } catch (notifyErr) {
      console.error('Non-critical notification error on report no-show:', notifyErr);
    }

    return updatedVisit;
  }

  // ==========================================
  // AUTO-EXPIRE UNANSWERED REQUESTS (PHASE 1)
  // ==========================================
  async autoExpireRequests() {
    const cutoff = new Date(Date.now() - WORKFLOW_CONFIG.visit.requestExpiryHours * 60 * 60 * 1000);

    const pendingVisits = await this.prisma.visitRequest.findMany({
      where: {
        status: { in: [VisitStatus.REQUESTED, VisitStatus.PENDING] },
        createdAt: { lte: cutoff },
      },
      include: { property: true },
    });

    const expiredIds: string[] = [];
    const now = new Date();

    for (const v of pendingVisits) {
      const currentDomainStatus = normalizeVisitStatus(v.status);
      if (VisitStateMachine.canTransition(currentDomainStatus, DomainVisitStatus.EXPIRED, 'SYSTEM')) {
        await this.prisma.visitRequest.update({
          where: { id: v.id },
          data: {
            status: VisitStatus.EXPIRED,
            expiredAt: now,
          },
        });

        await this.auditService.logTransition({
          entity: 'VISIT',
          entityId: v.id,
          fromStatus: currentDomainStatus,
          toStatus: DomainVisitStatus.EXPIRED,
          actorId: 'system',
          actorRole: 'SYSTEM',
          reason: `Auto-expired: Landlord did not respond within ${WORKFLOW_CONFIG.visit.requestExpiryHours}h`,
        });

        try {
          await this.notificationsService.create(
            v.tenantId,
            NotificationType.VISIT_DECLINED,
            'Visit Request Expired',
            `Your visit request for ${v.property.title} has expired after 48 hours without landlord confirmation.`,
            { visitId: v.id, propertyId: v.propertyId },
          );
        } catch (notifyErr) {
          console.error('Non-critical notification error on auto-expire:', notifyErr);
        }

        expiredIds.push(v.id);
      }
    }

    return { expiredCount: expiredIds.length, expiredVisitIds: expiredIds };
  }

  // ==========================================
  // GENERATE .ICS CALENDAR INVITATION (PHASE 1)
  // ==========================================
  async getVisitIcs(visitId: string, userId: string, roles: string[] = []) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: {
        property: {
          include: {
            landlord: { select: { fullName: true, email: true } },
          },
        },
        tenant: { select: { fullName: true, email: true } },
      },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    this.resolveActorRole(userId, visit, roles);

    let slotDate: string | Date = visit.requestedDate;
    let slotTime = visit.requestedTime;
    if (visit.confirmedSlot && typeof visit.confirmedSlot === 'object') {
      const cs = visit.confirmedSlot as any;
      if (cs.date && cs.time) {
        slotDate = cs.date;
        slotTime = cs.time;
      }
    }

    const icsContent = this.icsGenerator.generateIcs({
      uid: visit.id,
      title: `Basha Vara Visit: ${visit.property.title}`,
      description: `Property inspection visit organized via Basha Vara.\nType: ${visit.visitType}\nGuests: ${visit.guestCount}`,
      location: `${visit.property.addressLine}, ${visit.property.area}, ${visit.property.city}`,
      scheduledDate: slotDate,
      scheduledTime: slotTime,
      durationMinutes: WORKFLOW_CONFIG.visit.defaultSlotDurationMinutes,
      organizerName: visit.property.landlord.fullName,
      organizerEmail: visit.property.landlord.email,
      attendeeName: visit.tenant.fullName,
      attendeeEmail: visit.tenant.email,
    });

    return {
      filename: `visit-${visit.id}.ics`,
      content: icsContent,
    };
  }

  // ==========================================
  // AVAILABILITY WINDOWS (PHASE 1)
  // ==========================================
  async getPropertyAvailability(propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    return this.prisma.propertyAvailabilityWindow.findMany({
      where: { propertyId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async setPropertyAvailability(
    propertyId: string,
    userId: string,
    roles: string[] = [],
    dto: SetPropertyAvailabilityDto,
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    if (!isAdmin && property.landlordId !== userId) {
      throw new ForbiddenException('Only the landlord of this property can configure availability windows.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.propertyAvailabilityWindow.deleteMany({
        where: { propertyId },
      });

      if (dto.windows && dto.windows.length > 0) {
        await tx.propertyAvailabilityWindow.createMany({
          data: dto.windows.map((w) => ({
            propertyId,
            dayOfWeek: w.dayOfWeek,
            startTime: w.startTime.trim(),
            endTime: w.endTime.trim(),
            isActive: w.isActive ?? true,
          })),
        });
      }

      return tx.propertyAvailabilityWindow.findMany({
        where: { propertyId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });
  }

  // ==========================================
  // PHASE 2 - HARDENED VISIT VERIFICATION
  // ==========================================

  /**
   * Retrieves the secure check-in verification code to display to the landlord.
   * Tenant can only DISPLAY this code; only the landlord can verify it.
   */
  async getTenantCheckInCode(visitId: string, userId: string, roles: string[] = []) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    if (!isAdmin && visit.tenantId !== userId) {
      throw new ForbiddenException('Only the scheduled tenant can access their check-in verification code.');
    }

    const currentDomainStatus = normalizeVisitStatus(visit.status);
    if (currentDomainStatus !== DomainVisitStatus.CONFIRMED) {
      throw new BadRequestException('Check-in codes are only available for confirmed visits.');
    }

    if (visit.verificationLockedAt) {
      throw new ForbiddenException('Verification for this visit has been locked due to excessive failed attempts.');
    }

    // Evaluate window
    let slotDate: string | Date = visit.requestedDate;
    let slotTime = visit.requestedTime;
    if (visit.confirmedSlot && typeof visit.confirmedSlot === 'object') {
      const cs = visit.confirmedSlot as any;
      if (cs.date && cs.time) {
        slotDate = cs.date;
        slotTime = cs.time;
      }
    }

    const windowResult = VerificationPolicy.evaluateCheckInWindow(
      slotDate,
      slotTime,
      WORKFLOW_CONFIG.visit.defaultSlotDurationMinutes,
      WORKFLOW_CONFIG.verification.otpWindowBeforeStartMinutes,
      WORKFLOW_CONFIG.verification.otpWindowAfterEndHours,
      new Date(),
    );

    return {
      otp: visit.tenantOtp,
      windowOpensAt: windowResult.windowOpensAt,
      windowClosesAt: windowResult.windowClosesAt,
      isWindowActive: windowResult.valid,
      windowReason: windowResult.reason,
    };
  }

  /**
   * Hardened check-in verification executed by the landlord using the tenant's displayed code.
   * Checks check-in time window, locks after 5 failed attempts, evaluates GPS soft signal,
   * sets verification badge to IN_PERSON_VERIFIED, and sets 14-day expiry.
   */
  async verifyCheckIn(
    visitId: string,
    userId: string,
    roles: string[] = [],
    dto: VerifyCheckInDto,
  ) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true, tenant: true },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    const isLandlord = visit.property.landlordId === userId;
    const isTenant = visit.tenantId === userId;

    if (isTenant && !isAdmin && !isLandlord) {
      throw new ForbiddenException(
        'Tenants cannot self-verify visits. The landlord must verify the visit code displayed by the tenant.',
      );
    }

    if (!isLandlord && !isAdmin) {
      throw new ForbiddenException('Only the landlord of this property can verify visitor check-in.');
    }

    const currentDomainStatus = normalizeVisitStatus(visit.status);
    if (currentDomainStatus === DomainVisitStatus.COMPLETED || visit.visitVerifiedAt) {
      throw new BadRequestException('This visit has already been verified and completed.');
    }

    if (currentDomainStatus !== DomainVisitStatus.CONFIRMED) {
      throw new BadRequestException('Check-in verification is only available for confirmed visits.');
    }

    // Check lockout
    if (
      visit.verificationLockedAt ||
      VerificationPolicy.isLocked(
        visit.verificationFailedAttempts,
        WORKFLOW_CONFIG.verification.maxFailedAttempts,
      )
    ) {
      throw new ForbiddenException(
        'Verification for this visit is locked due to too many failed attempts. Please contact support.',
      );
    }

    // Check window
    let slotDate: string | Date = visit.requestedDate;
    let slotTime = visit.requestedTime;
    if (visit.confirmedSlot && typeof visit.confirmedSlot === 'object') {
      const cs = visit.confirmedSlot as any;
      if (cs.date && cs.time) {
        slotDate = cs.date;
        slotTime = cs.time;
      }
    }

    const windowResult = VerificationPolicy.evaluateCheckInWindow(
      slotDate,
      slotTime,
      WORKFLOW_CONFIG.visit.defaultSlotDurationMinutes,
      WORKFLOW_CONFIG.verification.otpWindowBeforeStartMinutes,
      WORKFLOW_CONFIG.verification.otpWindowAfterEndHours,
      new Date(),
    );

    if (!windowResult.valid) {
      throw new BadRequestException(windowResult.message);
    }

    // Verify OTP hash
    const trimmedOtp = dto.otp?.trim();
    let isValid = false;

    if (visit.otpSalt && visit.tenantOtpHashed) {
      isValid = OtpHasher.verifyOtpHash(trimmedOtp, visit.otpSalt, visit.tenantOtpHashed);
    } else if (visit.tenantOtp) {
      isValid = visit.tenantOtp === trimmedOtp;
    }

    if (!isValid) {
      const newFailedAttempts = visit.verificationFailedAttempts + 1;
      const isNowLocked = VerificationPolicy.isLocked(
        newFailedAttempts,
        WORKFLOW_CONFIG.verification.maxFailedAttempts,
      );

      await this.prisma.visitRequest.update({
        where: { id: visitId },
        data: {
          verificationFailedAttempts: newFailedAttempts,
          ...(isNowLocked && {
            verificationLockedAt: new Date(),
            verificationLockedReason: `Locked after ${newFailedAttempts} consecutive failed attempts`,
          }),
        },
      });

      await this.auditService.logTransition({
        entity: 'VISIT_VERIFICATION',
        entityId: visit.id,
        fromState: currentDomainStatus,
        toState: isNowLocked ? 'LOCKED' : currentDomainStatus,
        actorId: userId,
        actorRole: 'LANDLORD',
        reason: `Failed OTP check-in attempt (${newFailedAttempts}/${WORKFLOW_CONFIG.verification.maxFailedAttempts})`,
        metadata: { attempt: newFailedAttempts, locked: isNowLocked },
      });

      if (isNowLocked) {
        try {
          await this.notificationsService.create(
            visit.property.landlordId,
            NotificationType.VISIT_CANCELLED,
            'Visit Verification Locked',
            `Verification for visit at ${visit.property.title} was locked after 5 failed attempts.`,
            { visitId, propertyId: visit.propertyId },
          );
        } catch {}
        throw new ForbiddenException(
          'Verification failed: maximum failed attempts reached (5/5). Visit verification is now locked.',
        );
      }

      const remaining = WORKFLOW_CONFIG.verification.maxFailedAttempts - newFailedAttempts;
      throw new BadRequestException(`Invalid verification code. Remaining attempts: ${remaining}.`);
    }

    // Successful Verification
    const now = new Date();
    const verifiedVisitorExpiresAt = new Date(
      now.getTime() + WORKFLOW_CONFIG.verification.verifiedVisitorExpiryDays * 24 * 60 * 60 * 1000,
    );

    const checkInMetadata = {
      verifiedByRole: 'LANDLORD',
      clientLocation:
        dto.latitude && dto.longitude
          ? { lat: dto.latitude, lon: dto.longitude, accuracy: dto.accuracyMeters }
          : null,
      verifiedAt: now.toISOString(),
    };

    const updatedVisit = await this.prisma.visitRequest.update({
      where: { id: visitId },
      data: {
        status: VisitStatus.COMPLETED,
        visitVerifiedAt: now,
        landlordOtpVerifiedAt: now,
        tenantOtpVerifiedAt: now,
        landlordAttended: true,
        verificationBadge: VerificationBadgeType.IN_PERSON_VERIFIED,
        verifiedVisitorExpiresAt,
        checkInMetadata: checkInMetadata as any,
        verificationFailedAttempts: 0,
      },
      include: { property: true, tenant: true },
    });

    await this.auditService.logTransition({
      entity: 'VISIT',
      entityId: visit.id,
      fromStatus: currentDomainStatus,
      toStatus: DomainVisitStatus.COMPLETED,
      actorId: userId,
      actorRole: 'LANDLORD',
      reason: 'Landlord verified in-person check-in code',
      metadata: { badge: 'IN_PERSON_VERIFIED', checkInMetadata },
    });

    try {
      await this.notificationsService.create(
        visit.tenantId,
        NotificationType.VISIT_COMPLETED,
        'Visit Verified & Completed',
        `Your visit for ${visit.property.title} is verified! You now hold Verified Visitor status and can apply for this listing.`,
        { visitId, propertyId: visit.propertyId },
      );
    } catch {}

    return updatedVisit;
  }

  /**
   * Video visits: separate verification.
   * Both tenant and landlord must confirm call attendance in-app to award VIDEO_VERIFIED badge.
   */
  async confirmVideoCall(
    visitId: string,
    userId: string,
    roles: string[] = [],
    dto: ConfirmVideoCallDto = {},
  ) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true, tenant: true },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const actorRole = this.resolveActorRole(userId, visit, roles);
    const currentDomainStatus = normalizeVisitStatus(visit.status);

    if (visit.visitType !== 'VIDEO_CALL') {
      throw new BadRequestException('Video call confirmation is only applicable to video visits.');
    }

    if (
      currentDomainStatus !== DomainVisitStatus.CONFIRMED &&
      currentDomainStatus !== DomainVisitStatus.COMPLETED
    ) {
      throw new BadRequestException('Video calls can only be confirmed for confirmed visits.');
    }

    const now = new Date();
    const isTenant = actorRole === 'TENANT';
    const isLandlord = actorRole === 'LANDLORD';

    const updateData: any = {};
    if (isTenant || actorRole === 'ADMIN') {
      updateData.tenantConfirmedCallAt = now;
    }
    if (isLandlord || actorRole === 'ADMIN') {
      updateData.landlordConfirmedCallAt = now;
    }

    const hasTenantConfirmed = Boolean(visit.tenantConfirmedCallAt || updateData.tenantConfirmedCallAt);
    const hasLandlordConfirmed = Boolean(visit.landlordConfirmedCallAt || updateData.landlordConfirmedCallAt);

    if (hasTenantConfirmed && hasLandlordConfirmed) {
      updateData.status = VisitStatus.COMPLETED;
      updateData.visitVerifiedAt = visit.visitVerifiedAt || now;
      updateData.verificationBadge = VerificationBadgeType.VIDEO_VERIFIED;
      updateData.verifiedVisitorExpiresAt = new Date(
        now.getTime() + WORKFLOW_CONFIG.verification.verifiedVisitorExpiryDays * 24 * 60 * 60 * 1000,
      );
    }

    const updatedVisit = await this.prisma.visitRequest.update({
      where: { id: visitId },
      data: updateData,
      include: { property: true, tenant: true },
    });

    if (hasTenantConfirmed && hasLandlordConfirmed) {
      await this.auditService.logTransition({
        entity: 'VISIT',
        entityId: visit.id,
        fromStatus: currentDomainStatus,
        toStatus: DomainVisitStatus.COMPLETED,
        actorId: userId,
        actorRole,
        reason: 'Both parties confirmed video visit completion',
        metadata: { badge: 'VIDEO_VERIFIED', durationMinutes: dto.durationMinutes, notes: dto.notes },
      });

      try {
        await this.notificationsService.create(
          visit.tenantId,
          NotificationType.VISIT_COMPLETED,
          'Video Visit Verified',
          `Your video visit for ${visit.property.title} was verified by both parties.`,
          { visitId, propertyId: visit.propertyId },
        );
      } catch {}
    } else {
      const counterpartId = isTenant ? visit.property.landlordId : visit.tenantId;
      try {
        await this.notificationsService.create(
          counterpartId,
          NotificationType.VISIT_REQUESTED,
          'Video Visit Awaiting Your Confirmation',
          `${actorRole} has confirmed attendance of the video call for ${visit.property.title}. Please confirm in-app.`,
          { visitId, propertyId: visit.propertyId },
        );
      } catch {}
    }

    return updatedVisit;
  }

  /**
   * Tenant reports landlord no-show after the visit window closes.
   * Marks visit as LANDLORD_NO_SHOW and reduces landlord trust score by 10 points.
   */
  async reportLandlordNoShow(
    visitId: string,
    userId: string,
    roles: string[] = [],
    dto: ReportLandlordNoShowDto = {},
  ) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true, tenant: true },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const actorRole = this.resolveActorRole(userId, visit, roles);
    const currentDomainStatus = normalizeVisitStatus(visit.status);

    this.checkStateTransition(currentDomainStatus, DomainVisitStatus.LANDLORD_NO_SHOW, actorRole);

    // Verify scheduled window has passed
    let slotDate: string | Date = visit.requestedDate;
    let slotTime = visit.requestedTime;
    if (visit.confirmedSlot && typeof visit.confirmedSlot === 'object') {
      const cs = visit.confirmedSlot as any;
      if (cs.date && cs.time) {
        slotDate = cs.date;
        slotTime = cs.time;
      }
    }

    const scheduledStart = VisitPolicy.parseSlotDateTime(slotDate, slotTime);
    const windowEnd = new Date(
      scheduledStart.getTime() + WORKFLOW_CONFIG.visit.defaultSlotDurationMinutes * 60 * 1000,
    );

    if (Date.now() < windowEnd.getTime() && actorRole !== 'ADMIN') {
      throw new BadRequestException(
        'Cannot report landlord no-show before the scheduled visit window has concluded.',
      );
    }

    const updatedVisit = await this.prisma.visitRequest.update({
      where: { id: visitId },
      data: {
        status: VisitStatus.LANDLORD_NO_SHOW,
        landlordNoShowReportedAt: new Date(),
        landlordNoShowReportedBy: userId,
        landlordAttended: false,
      },
      include: { property: true, tenant: true },
    });

    // Process token hold refund (full refund for landlord no-show)
    if (visit.tokenHoldAmount) {
      try {
        await this.tokenHoldWorker.handleLandlordSideCancellation(visitId, 'LANDLORD_NO_SHOW');
      } catch (refundErr) {
        console.error('Non-critical token hold refund error on landlord no-show:', refundErr);
      }
    }

    // Reduce Landlord trust score by 10 points
    try {
      const landlordProfile = await this.prisma.landlordProfile.findUnique({
        where: { userId: visit.property.landlordId },
      });
      if (landlordProfile) {
        const newScore = Math.max(0, (landlordProfile.trustScore ?? 100) - 10);
        await this.prisma.landlordProfile.update({
          where: { id: landlordProfile.id },
          data: { trustScore: newScore },
        });
      }
    } catch (err) {
      console.error('Failed to adjust landlord trust score on no-show:', err);
    }

    await this.auditService.logTransition({
      entity: 'VISIT',
      entityId: visit.id,
      fromStatus: currentDomainStatus,
      toStatus: DomainVisitStatus.LANDLORD_NO_SHOW,
      actorId: userId,
      actorRole,
      reason: dto.reason || 'Tenant reported landlord no-show after scheduled window',
      metadata: { evidencePhotoUrl: dto.evidencePhotoUrl },
    });

    try {
      await this.notificationsService.create(
        visit.property.landlordId,
        NotificationType.VISIT_CANCELLED,
        'Landlord No-Show Reported',
        `A tenant reported a no-show for the visit at ${visit.property.title}. Your landlord trust score has been reduced.`,
        { visitId, propertyId: visit.propertyId },
      );
    } catch {}

    return updatedVisit;
  }

  /**
   * Helper verifying whether a tenant holds active Verified Visitor status for a listing.
   */
  async isVerifiedVisitorForListing(tenantId: string, propertyId: string): Promise<boolean> {
    const verifiedVisit = await this.prisma.visitRequest.findFirst({
      where: {
        tenantId,
        propertyId,
        status: VisitStatus.COMPLETED,
        visitVerifiedAt: { not: null },
      },
      orderBy: { visitVerifiedAt: 'desc' },
    });

    if (!verifiedVisit || !verifiedVisit.visitVerifiedAt) {
      return false;
    }

    return VerificationPolicy.isVerifiedVisitorActive(
      verifiedVisit.visitVerifiedAt,
      WORKFLOW_CONFIG.verification.verifiedVisitorExpiryDays,
      new Date(),
    );
  }

  // ==========================================
  // LEGACY & SHARED METHODS (PRESERVED)
  // ==========================================
  async update(visitId: string, tenantId: string, dto: UpdateVisitRequestDto) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    if (visit.tenantId !== tenantId) {
      throw new ForbiddenException('You can only edit your own visit requests');
    }

    const currentDomainStatus = normalizeVisitStatus(visit.status);
    if (currentDomainStatus !== DomainVisitStatus.REQUESTED) {
      throw new BadRequestException('You can only edit visit requests that are still pending/requested');
    }

    return this.prisma.visitRequest.update({
      where: { id: visitId },
      data: {
        ...(dto.requestedDate !== undefined && { requestedDate: dto.requestedDate }),
        ...(dto.requestedTime !== undefined && { requestedTime: dto.requestedTime.trim() }),
        ...(dto.message !== undefined && { message: dto.message?.trim() || null }),
        ...(dto.visitType !== undefined && { visitType: dto.visitType }),
        ...(dto.guestCount !== undefined && { guestCount: dto.guestCount }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone || null }),
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
            rentAmount: true,
            photos: { take: 1 },
            landlordId: true,
          },
        },
      },
    });
  }

  async findTenantVisits(tenantId: string) {
    return this.prisma.visitRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
            rentAmount: true,
            photos: { take: 1 },
            landlord: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  async findLandlordVisits(landlordId: string) {
    return this.prisma.visitRequest.findMany({
      where: {
        property: { landlordId },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            tenantProfile: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
            rentAmount: true,
            photos: { take: 1 },
          },
        },
      },
    });
  }

  async updateStatus(
    visitId: string,
    userId: string,
    roles: string[],
    dto: UpdateVisitStatusDto,
  ) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const actorRole = this.resolveActorRole(userId, visit, roles);
    const currentDomainStatus = normalizeVisitStatus(visit.status);
    const targetDomainStatus = normalizeVisitStatus(dto.status);

    this.checkStateTransition(currentDomainStatus, targetDomainStatus, actorRole);

    const updateData: any = { status: dto.status };
    if (dto.status === VisitStatus.ACCEPTED) {
      if (!visit.tenantOtp) {
        updateData.tenantOtp =
          this.otpService.generateOtp(`${visitId}-tenant`) ||
          Math.floor(100000 + Math.random() * 900000).toString();
      }
      if (!visit.landlordOtp) {
        updateData.landlordOtp =
          this.otpService.generateOtp(`${visitId}-landlord`) ||
          Math.floor(100000 + Math.random() * 900000).toString();
      }
    }

    const updatedVisit = await this.prisma.visitRequest.update({
      where: { id: visitId },
      data: updateData,
      include: {
        property: { select: { id: true, title: true, area: true } },
        tenant: { select: { id: true, fullName: true, email: true } },
      },
    });

    await this.auditService.logTransition({
      entity: 'VISIT',
      entityId: visit.id,
      fromStatus: currentDomainStatus,
      toStatus: targetDomainStatus,
      actorId: userId,
      actorRole,
      reason: `Status updated to ${dto.status}`,
    });

    return updatedVisit;
  }

  async generateOtp(visitId: string, userId: string, role: 'landlord' | 'tenant') {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    if (role === 'landlord' && visit.property.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can generate landlord OTP');
    }

    if (role === 'tenant' && visit.tenantId !== userId) {
      throw new ForbiddenException('Only tenant can generate tenant OTP');
    }

    const currentDomainStatus = normalizeVisitStatus(visit.status);
    if (currentDomainStatus !== DomainVisitStatus.CONFIRMED) {
      throw new BadRequestException('OTP can only be generated for confirmed visits');
    }

    const otpKey = `${visitId}-${role}`;
    const otp = this.otpService.generateOtp(otpKey) || Math.floor(100000 + Math.random() * 900000).toString();

    const updateData: any = {};
    if (role === 'landlord') {
      updateData.landlordOtp = otp;
    } else {
      updateData.tenantOtp = otp;
    }

    await this.prisma.visitRequest.update({
      where: { id: visitId },
      data: updateData,
    });

    return { otp, expiresAt: this.otpService.getOtpExpiryTime(otpKey) || Date.now() + 15 * 60 * 1000 };
  }

  async verifyOtp(visitId: string, userId: string, role: 'landlord' | 'tenant', otp: string) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    if (role === 'landlord' && visit.property.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can verify landlord OTP');
    }

    if (role === 'tenant' && visit.tenantId !== userId) {
      throw new ForbiddenException('Only tenant can verify tenant OTP');
    }

    if (visit.status === VisitStatus.COMPLETED || visit.visitVerifiedAt) {
      throw new BadRequestException('This visit has already been verified and completed');
    }

    const currentDomainStatus = normalizeVisitStatus(visit.status);
    if (currentDomainStatus !== DomainVisitStatus.CONFIRMED) {
      throw new BadRequestException('OTP can only be verified for confirmed visits');
    }

    const trimmedOtp = otp?.trim();
    const counterpartRole = role === 'landlord' ? 'tenant' : 'landlord';
    const counterpartKey = `${visitId}-${counterpartRole}`;

    const isCounterpartValid = this.otpService.verifyOtp(counterpartKey, trimmedOtp);
    const isDbMatch =
      !isCounterpartValid &&
      Boolean(
        (role === 'landlord' && visit.tenantOtp === trimmedOtp) ||
        (role === 'tenant' && visit.landlordOtp === trimmedOtp)
      );

    const isValid = isCounterpartValid || isDbMatch;

    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const now = new Date();
    const updateData: any = {
      landlordOtpVerifiedAt: visit.landlordOtpVerifiedAt || now,
      tenantOtpVerifiedAt: visit.tenantOtpVerifiedAt || now,
      status: VisitStatus.COMPLETED,
      visitVerifiedAt: visit.visitVerifiedAt || now,
    };

    const updatedVisit = await this.prisma.visitRequest.update({
      where: { id: visitId },
      data: updateData,
      include: { property: true },
    });

    await this.auditService.logTransition({
      entity: 'VISIT',
      entityId: visit.id,
      fromStatus: currentDomainStatus,
      toStatus: DomainVisitStatus.COMPLETED,
      actorId: userId,
      actorRole: role === 'landlord' ? 'LANDLORD' : 'TENANT',
      reason: 'Visit check-in verified via OTP',
    });

    try {
      await this.notificationsService.create(
        visit.tenantId,
        NotificationType.VISIT_COMPLETED,
        'Visit Completed',
        `Your visit for ${visit.property.title} has been verified and completed. You can now apply for this property.`,
        { visitId, propertyId: visit.propertyId },
      );
    } catch (err) {
      console.error('Failed to notify tenant on visit completion:', err);
    }

    return updatedVisit;
  }

  async completeVisit(visitId: string, userId: string) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    if (visit.property.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can complete visit');
    }

    if (!visit.landlordOtpVerifiedAt || !visit.tenantOtpVerifiedAt) {
      throw new BadRequestException('Both parties must verify OTP before completing visit');
    }

    const currentDomainStatus = normalizeVisitStatus(visit.status);
    this.checkStateTransition(currentDomainStatus, DomainVisitStatus.COMPLETED, 'LANDLORD');

    const updatedVisit = await this.prisma.visitRequest.update({
      where: { id: visitId },
      data: {
        status: VisitStatus.COMPLETED,
        visitVerifiedAt: new Date(),
      },
    });

    await this.auditService.logTransition({
      entity: 'VISIT',
      entityId: visit.id,
      fromStatus: currentDomainStatus,
      toStatus: DomainVisitStatus.COMPLETED,
      actorId: userId,
      actorRole: 'LANDLORD',
      reason: 'Landlord completed verified visit',
    });

    await this.notificationsService.create(
      visit.tenantId,
      NotificationType.VISIT_COMPLETED,
      'Visit Completed',
      `Your visit for ${visit.property.title} has been verified and completed. You can now apply for this property.`,
      { visitId, propertyId: visit.propertyId },
    );

    return updatedVisit;
  }

  async initiateTokenHold(visitId: string, userId: string, amount: number) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    if (visit.tenantId !== userId) {
      throw new ForbiddenException('Only tenant can initiate token hold');
    }

    const currentDomainStatus = normalizeVisitStatus(visit.status);
    if (currentDomainStatus !== DomainVisitStatus.CONFIRMED && currentDomainStatus !== DomainVisitStatus.COMPLETED) {
      throw new BadRequestException('Token hold can only be initiated for accepted visits');
    }

    if (visit.tokenHoldAmount) {
      throw new BadRequestException('Token hold already initiated for this visit');
    }

    // Check if property is already locked by another visit
    if (visit.property.lockedByVisitId && visit.property.lockedByVisitId !== visitId) {
      throw new BadRequestException('Property is already locked by another visit');
    }

    const tokenHoldExpiresAt = new Date(Date.now() + WORKFLOW_CONFIG.application.tokenHoldLockHours * 60 * 60 * 1000);

    const updatedVisit = await this.prisma.$transaction(async (tx) => {
      const updatedVisit = await tx.visitRequest.update({
        where: { id: visitId },
        data: {
          tokenHoldAmount: amount,
          tokenHoldExpiresAt,
        },
      });

      await tx.property.update({
        where: { id: visit.propertyId },
        data: {
          lockedByVisitId: visitId,
          lockedUntil: tokenHoldExpiresAt,
        },
      });

      return updatedVisit;
    });

    try {
      await this.tokenHoldWorker.scheduleExpiry(visitId, tokenHoldExpiresAt);
    } catch (scheduleErr) {
      console.error('Non-critical token hold expiry scheduling error:', scheduleErr);
    }

    return updatedVisit;
  }

  async lockProperty(visitId: string, userId: string) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    if (visit.property.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can lock property');
    }

    if (!visit.tokenHoldAmount) {
      throw new BadRequestException('Token hold must be initiated before locking property');
    }

    if (visit.tokenHoldExpiresAt && new Date() > visit.tokenHoldExpiresAt) {
      throw new BadRequestException('Token hold has expired');
    }

    const updatedProperty = await this.prisma.property.update({
      where: { id: visit.propertyId },
      data: {
        lockedByVisitId: visitId,
        lockedUntil: visit.tokenHoldExpiresAt,
      },
    });

    return updatedProperty;
  }

  async unlockProperty(propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.lockedUntil && new Date() > property.lockedUntil) {
      await this.prisma.property.update({
        where: { id: propertyId },
        data: {
          lockedByVisitId: null,
          lockedUntil: null,
        },
      });
    }

    return { unlocked: true };
  }
}
