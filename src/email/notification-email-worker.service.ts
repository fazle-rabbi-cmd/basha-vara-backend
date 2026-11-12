import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  NOTIFICATION_EMAIL_QUEUE,
  type NotificationEmailJob,
  type NotificationEmailPurpose,
} from './notification-email.types.js';

@Injectable()
export class NotificationEmailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEmailWorkerService.name);
  private connection?: Redis;
  private worker?: Worker<NotificationEmailJob>;
  private transporter?: Transporter;
  private brevoApiKey?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const emailFrom = this.config.get<string>('EMAIL_FROM');
    this.brevoApiKey = this.config.get<string>('BREVO_API_KEY')?.trim() || undefined;
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!emailFrom || (!this.brevoApiKey && (!host || !user || !pass))) {
      this.logger.warn('Email worker not configured - skipping notification emails');
      return;
    }

    if (!this.brevoApiKey) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: { user, pass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        tls: { minVersion: 'TLSv1.2' },
      });
    }

    this.connection = new Redis(
      this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379',
      { maxRetriesPerRequest: null },
    );
    this.worker = new Worker(
      NOTIFICATION_EMAIL_QUEUE,
      (job) => this.processEmail(job.data),
      { connection: this.connection, concurrency: 5 },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Notification email job ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });
    this.logger.log(`Notification email worker started with ${this.brevoApiKey ? 'Brevo' : 'SMTP'} delivery`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit();
    this.transporter?.close();
  }

  private async processEmail(job: NotificationEmailJob) {
    const user = await this.prisma.user.findUnique({
      where: { id: job.userId },
      select: { id: true, email: true, fullName: true },
    });
    if (!user) return;

    const { subject, text } = this.getEmailContent(job.purpose, user.fullName, job.data);
    await this.sendEmail(user.email, subject, text);
  }

  private getEmailContent(
    purpose: NotificationEmailPurpose,
    userName: string,
    data: NotificationEmailJob['data'],
  ): { subject: string; text: string } {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    switch (purpose) {
      case 'NEW_VISIT_REQUEST':
        return {
          subject: `New Visit Request: ${data.propertyTitle}`,
          text: [
            `Hello ${userName},`,
            '',
            `You have received a new visit request for your property: ${data.propertyTitle}`,
            '',
            `Requested by: ${data.tenantName}`,
            `Date: ${data.visitDate}`,
            `Time: ${data.visitTime}`,
            '',
            `You can review and respond to this request in your dashboard.`,
            `${frontendUrl}/landlord/visits`,
            '',
            'Best regards,',
            'Basha Vara Team',
          ].join('\n'),
        };

      case 'NEW_APPLICATION':
        return {
          subject: `New Rental Application: ${data.propertyTitle}`,
          text: [
            `Hello ${userName},`,
            '',
            `You have received a new rental application for your property: ${data.propertyTitle}`,
            '',
            `Applicant: ${data.tenantName}`,
            '',
            `You can review the application and cover letter in your dashboard.`,
            `${frontendUrl}/landlord/applications`,
            '',
            'Best regards,',
            'Basha Vara Team',
          ].join('\n'),
        };

      case 'APPLICATION_SELECTED':
        return {
          subject: `Congratulations! Your Application was Selected`,
          text: [
            `Hello ${userName},`,
            '',
            `Great news! Your rental application for ${data.propertyTitle} has been selected by the landlord.`,
            '',
            `The landlord will contact you soon to discuss the next steps.`,
            '',
            `You can view your application status in your dashboard.`,
            `${frontendUrl}/tenant/applications`,
            '',
            'Congratulations!',
            'Basha Vara Team',
          ].join('\n'),
        };

      case 'VISIT_ACCEPTED':
        return {
          subject: `Visit Request Accepted: ${data.propertyTitle}`,
          text: [
            `Hello ${userName},`,
            '',
            `Your visit request for ${data.propertyTitle} has been accepted!`,
            '',
            `Visit Details:`,
            `Date: ${data.visitDate}`,
            `Time: ${data.visitTime}`,
            '',
            `Please arrive on time. If you need to reschedule, please contact the landlord.`,
            '',
            `You can view your visit status in your dashboard.`,
            `${frontendUrl}/tenant/visits`,
            '',
            'Best regards,',
            'Basha Vara Team',
          ].join('\n'),
        };

      case 'VISIT_CANCELLED':
        return {
          subject: `Visit Request Cancelled: ${data.propertyTitle}`,
          text: [
            `Hello ${userName},`,
            '',
            `Your visit request for ${data.propertyTitle} has been cancelled.`,
            '',
            `This is because the property has been rented by another tenant.`,
            '',
            `We apologize for any inconvenience. You can continue browsing other available properties.`,
            '',
            `You can view your visit status in your dashboard.`,
            `${frontendUrl}/tenant/visits`,
            '',
            'Best regards,',
            'Basha Vara Team',
          ].join('\n'),
        };

      default:
        return {
          subject: 'Basha Vara Notification',
          text: 'You have a new notification on Basha Vara.',
        };
    }
  }

  private async sendEmail(to: string, subject: string, text: string) {
    const from = this.config.getOrThrow<string>('EMAIL_FROM');
    const [fromName, fromEmail] = from.includes('<')
      ? [from.slice(0, from.indexOf('<')).trim(), from.slice(from.indexOf('<') + 1, from.indexOf('>')).trim()]
      : ['Basha Vara', from.trim()];

    if (this.brevoApiKey) {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          textContent: text,
        }),
      });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Brevo request failed (${response.status}): ${details}`);
      }
      return;
    }

    await this.transporter!.sendMail({ from, to, subject, text });
  }
}
