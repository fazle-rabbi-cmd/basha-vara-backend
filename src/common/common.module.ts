import { Module, Global } from '@nestjs/common';
import { CacheService } from './services/cache.service.js';
import { AuditService } from './services/audit.service.js';
import { WorkflowAuditService } from './services/workflow-audit.service.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { OwnershipGuard } from './guards/ownership.guard.js';
import { ContactInfoGuard } from './guards/contact-info.guard.js';

@Global()
@Module({
  providers: [CacheService, AuditService, WorkflowAuditService, PermissionsGuard, OwnershipGuard, ContactInfoGuard],
  exports: [CacheService, AuditService, WorkflowAuditService, PermissionsGuard, OwnershipGuard, ContactInfoGuard],
})
export class CommonModule {}
