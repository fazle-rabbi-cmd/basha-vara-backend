import { SetMetadata } from '@nestjs/common';
import { SystemPermission } from '@prisma/client';

export const FIELD_PERMISSIONS_KEY = 'fieldPermissions';

export const RequireFieldPermissions = (fieldPermissions: Record<string, SystemPermission[]>) =>
  SetMetadata(FIELD_PERMISSIONS_KEY, fieldPermissions);
