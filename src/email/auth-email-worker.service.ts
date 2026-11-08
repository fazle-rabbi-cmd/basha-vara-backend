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
  AUTH_EMAIL_PURPOSE,
  AUTH_EMAIL_QUEUE,
  type AuthEmailJob,
} from './auth-email.types.js';

@Injectable()
export class AuthEmailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthEmailWorkerService.name);
  private connection?: Redis;
  private worker?: Worker<AuthEmailJob>;
  private transporter?: Transporter;
  private brevoApiKey?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const emailFrom = this.config.get<string>('EMAIL_FROM');
    this.brevoApiKey = this.config.get<string>('BREVO_API_KEY');
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!emailFrom || (!this.brevoApiKey && (!host || !user || !pass))) {
      throw new Error(
        'Configure EMAIL_FROM and either BREVO_API_KEY or SMTP_HOST, SMTP_USER, and SMTP_PASS before starting the email worker.',
      );
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
      AUTH_EMAIL_QUEUE,
      (job) => this.processEmail(job.data),
      { connection: this.connection, concurrency: 5 },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Auth email job ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });
    this.logger.log(`Auth email worker started with ${this.brevoApiKey ? 'Brevo' : 'SMTP'} delivery`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit();
    this.transporter?.close();
  }

  private async processEmail(job: AuthEmailJob) {
    const user = await this.prisma.user.findUnique({
      where: { id: job.userId },
      select: { id: true, email: true, fullName: true, passwordHash: true, status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) return;

    const isAccountCreated = job.purpose === AUTH_EMAIL_PURPOSE.GOOGLE_ACCOUNT_CREATED;
    let link: URL | undefined;
    let isSetup = false;

    if (!isAccountCreated) {
      if (job.purpose === AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_SETUP && user.passwordHash) return;

      const purpose = job.purpose === AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_SETUP
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

      link = new URL('/set-password', this.config.getOrThrow<string>('FRONTEND_URL'));
      link.searchParams.set('token', token);
      isSetup = purpose === AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_SETUP;
    }

    const subject = isAccountCreated
      ? 'Your Basha Vara account is ready'
      : isSetup
      ? 'Set your Basha Vara password'
      : 'Reset your Basha Vara password';
    const text = [
      `Hello ${user.fullName},`,
      '',
      isAccountCreated
        ? 'Your Basha Vara account was created successfully with Google sign-in.'
        : isSetup
        ? 'Use the secure link below to set a password for email sign-in.'
        : 'Use the secure link below to choose a new password.',
      ...(isAccountCreated
        ? ['If you want to sign in with email and password, set a password from Security Settings after signing in with Google.']
        : ['This link expires in 30 minutes and can only be used once.', '', link!.toString()]),
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n');

    await this.sendEmail(user.email, subject, text);
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
