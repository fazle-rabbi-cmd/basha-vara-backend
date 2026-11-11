import { SetMetadata } from '@nestjs/common';
import { SystemPermission } from '@prisma/client';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: SystemPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
