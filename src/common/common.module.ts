import { Module, Global } from '@nestjs/common';
import { RedisService } from './services/redis.service.js';
import { AuditService } from './services/audit.service.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { OwnershipGuard } from './guards/ownership.guard.js';

@Global()
@Module({
  providers: [RedisService, AuditService, PermissionsGuard, OwnershipGuard],
  exports: [RedisService, AuditService, PermissionsGuard, OwnershipGuard],
})
export class CommonModule {}
