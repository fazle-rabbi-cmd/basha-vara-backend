import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface WorkflowTransitionAudit {
  entity: string; // e.g. 'VisitRequest', 'RentalApplication', 'Escrow'
  entityId: string;
  fromState?: string | null;
  fromStatus?: string | null;
  toState?: string;
  toStatus?: string;
  actorId: string;
  actorRole: string;
  reason?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class WorkflowAuditService {
  private readonly logger = new Logger(WorkflowAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an immutable audit event for a workflow state transition.
   */
  async logTransition(data: WorkflowTransitionAudit): Promise<void> {
    const fromVal = data.fromState ?? data.fromStatus ?? 'INITIAL';
    const toVal = data.toState ?? data.toStatus ?? 'UNKNOWN';

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.actorId,
          action: `${data.entity.toUpperCase()}_STATUS_TRANSITION`,
          resource: data.entity,
          resourceId: data.entityId,
          details: {
            fromState: fromVal,
            toState: toVal,
            actorRole: data.actorRole,
            reason: data.reason || null,
            metadata: data.metadata || {},
            timestamp: new Date().toISOString(),
          },
          success: true,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to write workflow audit log for ${data.entity} ${data.entityId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
