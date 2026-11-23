import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';

export enum LedgerAccountType {
  USER = 'USER',
  PLATFORM = 'PLATFORM',
  LANDLORD = 'LANDLORD',
  TENANT = 'TENANT',
}

export enum LedgerEntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private prisma: PrismaService) {}

  async getOrCreateAccount(accountType: LedgerAccountType, userId?: string) {
    const existing = await this.prisma.ledgerAccount.findFirst({
      where: {
        accountType,
        userId: userId || null,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.ledgerAccount.create({
      data: {
        accountType,
        userId: userId || null,
        balance: new Prisma.Decimal(0),
      },
    });
  }

  async createEntry(
    accountId: string,
    amount: number,
    entryType: LedgerEntryType,
    description: string,
    paymentId?: string,
  ) {
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new BadRequestException('Ledger account not found');
    }

    const amountDecimal = new Prisma.Decimal(amount);

    // Update account balance
    const balanceChange = entryType === LedgerEntryType.DEBIT ? amountDecimal : amountDecimal.negated();
    const newBalance = new Prisma.Decimal(account.balance).plus(balanceChange);

    return this.prisma.$transaction(async (tx) => {
      // Create ledger entry
      const entry = await tx.ledgerEntry.create({
        data: {
          accountId,
          paymentId,
          amount: amountDecimal,
          entryType,
          description,
        },
      });

      // Update account balance
      await tx.ledgerAccount.update({
        where: { id: accountId },
        data: { balance: newBalance },
      });

      this.logger.log(`Created ledger entry: ${entryType} ${amount} for account ${accountId}`);
      return entry;
    });
  }

  async recordPayment(paymentId: string, amount: number, tenantId: string, landlordId: string) {
    const platformAccount = await this.getOrCreateAccount(LedgerAccountType.PLATFORM);
    const tenantAccount = await this.getOrCreateAccount(LedgerAccountType.TENANT, tenantId);
    const landlordAccount = await this.getOrCreateAccount(LedgerAccountType.LANDLORD, landlordId);

    // Calculate platform fee
    const platformFee = Math.floor((amount * 290) / 10000) + 3000; // 2.9% + 30 BDT in poisha
    const landlordAmount = amount - platformFee;

    return this.prisma.$transaction(async (tx) => {
      // Debit tenant account (money leaving tenant)
      await this.createEntry(
        tenantAccount.id,
        amount,
        LedgerEntryType.DEBIT,
        `Payment for escrow - Payment ID: ${paymentId}`,
        paymentId,
      );

      // Credit platform account (platform fee)
      await this.createEntry(
        platformAccount.id,
        platformFee,
        LedgerEntryType.CREDIT,
        `Platform fee - Payment ID: ${paymentId}`,
        paymentId,
      );

      // Credit landlord account (money going to landlord)
      await this.createEntry(
        landlordAccount.id,
        landlordAmount,
        LedgerEntryType.CREDIT,
        `Escrow payment - Payment ID: ${paymentId}`,
        paymentId,
      );

      this.logger.log(`Recorded payment ${paymentId}: tenant=${amount}, platform=${platformFee}, landlord=${landlordAmount}`);
    });
  }

  async recordRelease(paymentId: string, amount: number, landlordId: string) {
    const platformAccount = await this.getOrCreateAccount(LedgerAccountType.PLATFORM);
    const landlordAccount = await this.getOrCreateAccount(LedgerAccountType.LANDLORD, landlordId);

    const platformFee = Math.floor((amount * 290) / 10000) + 3000;
    const landlordAmount = amount - platformFee;

    return this.prisma.$transaction(async (tx) => {
      // Debit platform account (platform fee released)
      await this.createEntry(
        platformAccount.id,
        platformFee,
        LedgerEntryType.DEBIT,
        `Platform fee released - Payment ID: ${paymentId}`,
        paymentId,
      );

      // Credit landlord account (final payment to landlord)
      await this.createEntry(
        landlordAccount.id,
        landlordAmount,
        LedgerEntryType.CREDIT,
        `Escrow released to landlord - Payment ID: ${paymentId}`,
        paymentId,
      );

      this.logger.log(`Recorded release ${paymentId}: platform=${platformFee}, landlord=${landlordAmount}`);
    });
  }

  async recordRefund(paymentId: string, amount: number, tenantId: string) {
    const platformAccount = await this.getOrCreateAccount(LedgerAccountType.PLATFORM);
    const tenantAccount = await this.getOrCreateAccount(LedgerAccountType.TENANT, tenantId);

    return this.prisma.$transaction(async (tx) => {
      // Debit platform account (refund from platform)
      await this.createEntry(
        platformAccount.id,
        amount,
        LedgerEntryType.DEBIT,
        `Refund to tenant - Payment ID: ${paymentId}`,
        paymentId,
      );

      // Credit tenant account (money back to tenant)
      await this.createEntry(
        tenantAccount.id,
        amount,
        LedgerEntryType.CREDIT,
        `Escrow refund - Payment ID: ${paymentId}`,
        paymentId,
      );

      this.logger.log(`Recorded refund ${paymentId}: amount=${amount}`);
    });
  }

  async getAccountBalance(accountType: LedgerAccountType, userId?: string) {
    const account = await this.prisma.ledgerAccount.findFirst({
      where: {
        accountType,
        userId: userId || null,
      },
    });

    return account ? Number(account.balance) : 0;
  }

  async getAccountEntries(accountId: string, limit = 50) {
    return this.prisma.ledgerEntry.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { payment: true },
    });
  }
}
