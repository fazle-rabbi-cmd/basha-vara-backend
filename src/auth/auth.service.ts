import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AuthEmailQueueService } from '../email/auth-email-queue.service.js';
import { AUTH_ACTION_TOKEN_PURPOSE } from '../email/auth-email.types.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private authEmailQueue: AuthEmailQueueService,
  ) {
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
    );
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    // Check phone if provided
    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone.trim() },
      });
      if (existingPhone) {
        throw new ConflictException('An account with this phone number already exists');
      }
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const assignedRole = dto.role ?? Role.TENANT;

    try {
      const newUser = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            fullName: dto.fullName.trim(),
            phone: dto.phone?.trim() || null,
            status: UserStatus.ACTIVE,
            roles: {
              create: [{ role: assignedRole }],
            },
          },
        });

        // Initialize tenant or landlord profile
        if (assignedRole === Role.LANDLORD) {
          await tx.landlordProfile.create({
            data: {
              userId: user.id,
              businessName: dto.fullName.trim(),
            },
          });
        } else {
          await tx.tenantProfile.create({
            data: {
              userId: user.id,
            },
          });
        }

        return tx.user.findUnique({
          where: { id: user.id },
          include: {
            roles: true,
            tenantProfile: true,
            landlordProfile: true,
          },
        });
      });

      if (!newUser) {
        throw new InternalServerErrorException('Failed to create user account');
      }

      const roles = newUser.roles.map((r) => r.role);
      const payload = { sub: newUser.id, email: newUser.email, roles };
      const accessToken = this.jwtService.sign(payload);

      return {
        accessToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          phone: newUser.phone,
          avatarUrl: newUser.avatarUrl,
          roles,
          tenantProfile: newUser.tenantProfile,
          landlordProfile: newUser.landlordProfile,
        },
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new BadRequestException('Could not complete registration: ' + (error as Error).message);
    }
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        roles: true,
        tenantProfile: true,
        landlordProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Your account has been suspended. Please contact support.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('No password is set for this account. Use Google sign-in or request a password setup email.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roles = user.roles.map((r) => r.role);
    const payload = { sub: user.id, email: user.email, roles };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        roles,
        tenantProfile: user.tenantProfile,
        landlordProfile: user.landlordProfile,
      },
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        tenantProfile: true,
        landlordProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      status: user.status,
      roles: user.roles.map((r) => r.role),
      tenantProfile: user.tenantProfile,
      landlordProfile: user.landlordProfile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async googleLogin(credential: string) {
    try {
      // Verify Google token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload?.email || !payload.email_verified) {
        throw new UnauthorizedException('Invalid Google token');
      }

      const normalizedEmail = payload.email.toLowerCase().trim();

      // Check if user exists
      let user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          roles: true,
          tenantProfile: true,
          landlordProfile: true,
        },
      });
      let isNewUser = false;

      if (!user) {
        user = await this.prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: normalizedEmail,
              passwordHash: null,
              fullName: payload.name || 'Google User',
              phone: null,
              status: UserStatus.ACTIVE,
              avatarUrl: payload.picture || null,
              roles: {
                create: [{ role: Role.TENANT }],
              },
            },
          });

          // Initialize tenant profile
          await tx.tenantProfile.create({
            data: {
              userId: newUser.id,
            },
          });

          return tx.user.findUnique({
            where: { id: newUser.id },
            include: {
              roles: true,
              tenantProfile: true,
              landlordProfile: true,
            },
          });
        });
        isNewUser = true;
      }

      if (!user) {
        throw new InternalServerErrorException('Failed to create user account');
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException('Your account has been suspended. Please contact support.');
      }

      if (isNewUser) {
        try {
          await this.authEmailQueue.queuePasswordLink(
            user.id,
            AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_SETUP,
          );
        } catch {
          this.logger.error('Unable to queue Google account password setup email');
        }
      }

      const roles = user.roles.map((r) => r.role);
      const jwtPayload = { sub: user.id, email: user.email, roles };
      const accessToken = this.jwtService.sign(jwtPayload);

      return {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          roles,
          tenantProfile: user.tenantProfile,
          landlordProfile: user.landlordProfile,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  async requestPasswordLink(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, passwordHash: true, status: true },
    });
    const genericMessage = 'If an account exists for that email, a password link will be sent.';

    if (!user || user.status !== UserStatus.ACTIVE) {
      return { message: genericMessage };
    }

    const purpose = user.passwordHash
      ? AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_RESET
      : AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_SETUP;
    const recentToken = await this.prisma.authActionToken.findFirst({
      where: {
        userId: user.id,
        purpose,
        usedAt: null,
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
      select: { id: true },
    });

    if (!recentToken) {
      await this.authEmailQueue.queuePasswordLink(user.id, purpose);
    }

    return { message: genericMessage };
  }

  async completePasswordSetup(token: string, password: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const authToken = await this.prisma.authActionToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    const now = new Date();

    if (!authToken || authToken.usedAt || authToken.expiresAt <= now) {
      throw new BadRequestException('This password link is invalid or has expired.');
    }
    if (authToken.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This account is not active.');
    }
    if (
      authToken.purpose === AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_SETUP &&
      authToken.user.passwordHash
    ) {
      throw new BadRequestException('A password is already set. Request a reset link instead.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.authActionToken.updateMany({
        where: { id: authToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw new BadRequestException('This password link is invalid or has expired.');
      }

      await tx.user.update({
        where: { id: authToken.userId },
        data: { passwordHash },
      });
      await tx.authActionToken.updateMany({
        where: { userId: authToken.userId, usedAt: null },
        data: { usedAt: now },
      });
    });

    return { message: 'Password set successfully. You can now sign in.' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user?.passwordHash) {
      throw new BadRequestException('Set a password using the email link before changing it.');
    }

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentPasswordMatches) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.authActionToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    return { message: 'Password changed successfully.' };
  }
}
