import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus, SystemPermission } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AuthEmailQueueService } from '../email/auth-email-queue.service.js';
import { AUTH_ACTION_TOKEN_PURPOSE, AUTH_EMAIL_PURPOSE } from '../email/auth-email.types.js';

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
      process.env.GOOGLE_CLIENT_SECRET,
    );
  }

  async register(dto: RegisterDto) {
    if (dto.role === 'ADMIN' || dto.role === 'SUPER_ADMIN') {
      throw new BadRequestException('Admin accounts cannot be created through public registration.');
    }

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

    const assignedRole = (dto.role ?? 'TENANT').toUpperCase();

    try {
      const role = await this.prisma.role.findUnique({
        where: { name: assignedRole },
      });

      if (!role) {
        throw new BadRequestException(`Role ${assignedRole} not found`);
      }

      const newUser = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            fullName: dto.fullName.trim(),
            phone: dto.phone?.trim() || null,
            status: UserStatus.ACTIVE,
            roles: {
              create: [{ roleId: role.id }],
            },
          },
        });

        // Initialize tenant or landlord profile
        if (assignedRole === 'LANDLORD') {
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
            roles: {
              include: {
                role: true,
              },
            },
            tenantProfile: true,
            landlordProfile: true,
          },
        });
      });

      if (!newUser) {
        throw new InternalServerErrorException('Failed to create user account');
      }

      const roles = newUser.roles.map((r) => r.role.name);
      const permissions = newUser.roles.flatMap((r) =>
        (r.role as any).rolePermissions?.map((rp: any) => rp.permission.name as SystemPermission) || [],
      );
      const payload = { sub: newUser.id, email: newUser.email, roles, permissions };
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
          permissions,
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
        roles: {
          include: {
            role: true,
          },
        },
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

    const roles = user.roles.map((r) => r.role.name);
    const permissions = user.roles.flatMap((r) =>
      (r.role as any).rolePermissions?.map((rp: any) => rp.permission.name as SystemPermission) || [],
    );
    const payload = { sub: user.id, email: user.email, roles, permissions };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        hasPassword: Boolean(user.passwordHash),
        roles,
        permissions,
        tenantProfile: user.tenantProfile,
        landlordProfile: user.landlordProfile,
      },
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        tenantProfile: true,
        landlordProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roles = user.roles.map((r) => r.role.name);
    const permissions = user.roles.flatMap((r) =>
      (r.role as any).rolePermissions?.map((rp: any) => rp.permission.name as SystemPermission) || [],
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      hasPassword: Boolean(user.passwordHash),
      status: user.status,
      roles,
      permissions,
      tenantProfile: user.tenantProfile,
      landlordProfile: user.landlordProfile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async googleLogin(credential: string, requestedRole?: string) {
    try {
      this.logger.log(`Attempting Google login with credential length: ${credential?.length}`);
      this.logger.log(`GOOGLE_CLIENT_ID configured: ${!!process.env.GOOGLE_CLIENT_ID}`);

      // Verify Google token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload?.email || !payload.email_verified) {
        this.logger.error('Google token missing email or not verified');
        throw new UnauthorizedException('Invalid Google token');
      }

      const normalizedEmail = payload.email.toLowerCase().trim();

      // Check if user exists
      let user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
          tenantProfile: true,
          landlordProfile: true,
        },
      });
      let isNewUser = false;

      if (!user) {
        const assignedRole = (requestedRole ?? 'TENANT').toUpperCase();
        const role = await this.prisma.role.findUnique({
          where: { name: assignedRole },
        });

        if (!role) {
          throw new BadRequestException(`Role ${assignedRole} not found`);
        }

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
                create: [{ roleId: role.id }],
              },
            },
          });

          if (assignedRole === 'LANDLORD') {
            await tx.landlordProfile.create({
              data: { userId: newUser.id, businessName: newUser.fullName },
            });
          } else {
            await tx.tenantProfile.create({
              data: { userId: newUser.id },
            });
          }

          return tx.user.findUnique({
            where: { id: newUser.id },
            include: {
              roles: {
                include: {
                  role: true,
                },
              },
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
          await this.authEmailQueue.queueEmail(
            user.id,
            AUTH_EMAIL_PURPOSE.GOOGLE_ACCOUNT_CREATED,
          );
        } catch {
          this.logger.error('Unable to queue Google account created email');
        }
      }

      const roles = user.roles.map((r) => r.role.name);
      const permissions = user.roles.flatMap((r) =>
        (r.role as any).rolePermissions?.map((rp: any) => rp.permission.name as SystemPermission) || [],
      );
      const jwtPayload = { sub: user.id, email: user.email, roles, permissions };
      const accessToken = this.jwtService.sign(jwtPayload);

      return {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          hasPassword: Boolean(user.passwordHash),
          roles,
          permissions,
          tenantProfile: user.tenantProfile,
          landlordProfile: user.landlordProfile,
        },
      };
    } catch (error) {
      this.logger.error(`Google login failed: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  getNativeGoogleAuthUrl(requestedRole: string = 'TENANT') {
    const redirectUri = process.env.GOOGLE_NATIVE_REDIRECT_URI;
    if (!redirectUri) {
      throw new InternalServerErrorException('Google native redirect URI is not configured.');
    }

    const state = this.jwtService.sign(
      { purpose: 'google-native', redirectUri, nonce: randomBytes(16).toString('hex'), role: requestedRole },
      { expiresIn: '10m' },
    );
    return this.googleClient.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      redirect_uri: redirectUri,
      prompt: 'select_account',
    });
  }

  async completeNativeGoogleLogin(code: string, state: string) {
    try {
      const statePayload = this.jwtService.verify<{ purpose: string; redirectUri: string; role?: string }>(state);
      if (statePayload.purpose !== 'google-native') {
        throw new UnauthorizedException('Invalid Google OAuth state.');
      }

      const { tokens } = await this.googleClient.getToken({
        code,
        redirect_uri: statePayload.redirectUri,
      });
      if (!tokens.id_token) {
        throw new UnauthorizedException('Google did not return an ID token.');
      }

      return this.googleLogin(tokens.id_token, statePayload.role);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`Native Google login failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new UnauthorizedException('Google authentication failed.');
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

  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user?.passwordHash) {
      const currentPasswordMatches = currentPassword
        ? await bcrypt.compare(currentPassword, user.passwordHash)
        : false;
      if (!currentPasswordMatches) {
        throw new UnauthorizedException('Current password is incorrect.');
      }
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
