import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { Worker } from 'bullmq';
import { createHash, randomBytes } from 'node:crypto';
import { Redis } from 'ioredis';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AUTH_ACTION_TOKEN_PURPOSE,
  AUTH_EMAIL_QUEUE,
  type AuthEmailJob,
} from './auth-email.types.js';

@Injectable()
export class AuthEmailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthEmailWorkerService.name);
  private connection?: Redis;
  private worker?: Worker<AuthEmailJob>;
  private transporter?: Transporter;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!host || !user || !pass || !this.config.get<string>('EMAIL_FROM')) {
      throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM must be configured before starting the email worker.');
    }

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
    this.connection = new Redis(
      this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379',
      { maxRetriesPerRequest: null },
    );
    this.worker = new Worker(
      AUTH_EMAIL_QUEUE,
      (job) => this.processPasswordLink(job.data),
      { connection: this.connection, concurrency: 5 },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Auth email job ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });
    this.logger.log('Auth email worker started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit();
    this.transporter?.close();
  }

  private async processPasswordLink(job: AuthEmailJob) {
    const user = await this.prisma.user.findUnique({
      where: { id: job.userId },
      select: { id: true, email: true, fullName: true, passwordHash: true, status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) return;
    if (job.purpose === 'PASSWORD_SETUP' && user.passwordHash) return;

    const purpose = job.purpose === 'PASSWORD_SETUP'
      ? AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_SETUP
      : AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_RESET;
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.authActionToken.deleteMany({
        where: {
          userId: user.id,
          OR: [{ usedAt: { not: null } }, { expiresAt: { lte: now } }],
        },
      });
      await tx.authActionToken.updateMany({
        where: { userId: user.id, purpose, usedAt: null },
        data: { usedAt: now },
      });
      await tx.authActionToken.create({
        data: {
          userId: user.id,
          tokenHash,
          purpose,
          expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
        },
      });
    });

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const link = new URL('/set-password', frontendUrl);
    link.searchParams.set('token', token);
    const isSetup = purpose === AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_SETUP;
    await this.transporter!.sendMail({
      from: this.config.getOrThrow<string>('EMAIL_FROM'),
      to: user.email,
      subject: isSetup ? 'Set your Basha Vara password' : 'Reset your Basha Vara password',
      text: [
        `Hello ${user.fullName},`,
        '',
        isSetup
          ? 'Use the secure link below to set a password for email sign-in.'
          : 'Use the secure link below to choose a new password.',
        'This link expires in 30 minutes and can only be used once.',
        '',
        link.toString(),
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
    });

    /* Resend delivery is disabled while SMTP is used.
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.getOrThrow<string>('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.getOrThrow<string>('EMAIL_FROM'),
        to: [user.email],
        subject: isSetup ? 'Set your Basha Vara password' : 'Reset your Basha Vara password',
        text: [
          `Hello ${user.fullName},`,
          '',
          isSetup ? 'Use the secure link below to set a password for email sign-in.' : 'Use the secure link below to choose a new password.',
          'This link expires in 30 minutes and can only be used once.',
          '',
          link.toString(),
          '',
          'If you did not request this, you can ignore this email.',
        ].join('\\n'),
      }),
    });
    */
  }
}