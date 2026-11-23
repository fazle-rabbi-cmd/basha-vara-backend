import { Module, Global } from '@nestjs/common';
import { RedisService } from './services/redis.service.js';
import { AuditService } from './services/audit.service.js';
import { WorkflowAuditService } from './services/workflow-audit.service.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { OwnershipGuard } from './guards/ownership.guard.js';
import { ContactInfoGuard } from './guards/contact-info.guard.js';

@Global()
@Module({
  providers: [RedisService, AuditService, WorkflowAuditService, PermissionsGuard, OwnershipGuard, ContactInfoGuard],
  exports: [RedisService, AuditService, WorkflowAuditService, PermissionsGuard, OwnershipGuard, ContactInfoGuard],
})
export class CommonModule {}
