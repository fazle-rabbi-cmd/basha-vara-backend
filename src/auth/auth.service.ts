import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
      if (!payload || !payload.email) {
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

      if (!user) {
        // Create new user from Google data
        const passwordHash = await bcrypt.hash(
          Math.random().toString(36).slice(-10),
          10,
        );

        user = await this.prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: normalizedEmail,
              passwordHash,
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
      }

      if (!user) {
        throw new InternalServerErrorException('Failed to create user account');
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException('Your account has been suspended. Please contact support.');
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
}
