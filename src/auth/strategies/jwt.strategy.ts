import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserStatus, SystemPermission } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions?: SystemPermission[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret =
      configService.get<string>('JWT_ACCESS_SECRET') ||
      'dev_jwt_access_secret_basha_vara_2026_super_secure_key';

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => {
          return request?.cookies?.access_token || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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
      },
    });

    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('User account is invalid or suspended');
    }

    const roleNames = user.roles.map((r) => r.role.name);
    const permissions = user.roles.flatMap((r) =>
      (r.role as any).rolePermissions?.map((rp: any) => rp.permission.name as SystemPermission) || [],
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      status: user.status,
      roles: roleNames,
      permissions,
    };
  }
}
