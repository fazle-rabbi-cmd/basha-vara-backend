import { Module } from '@nestjs/common';
import { MessagingGateway } from './gateway.gateway.js';
import { MessagesModule } from '../messages/messages.module.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MessagesModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_ACCESS_SECRET') ||
          'dev_jwt_access_secret_basha_vara_2026_super_secure_key',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m') as any,
        },
      }),
    }),
  ],
  providers: [MessagingGateway],
  exports: [MessagingGateway],
})
export class WebSocketsModule {}
