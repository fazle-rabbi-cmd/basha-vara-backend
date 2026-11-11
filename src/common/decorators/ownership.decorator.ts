import { SetMetadata } from '@nestjs/common';

export const RESOURCE_KEY = 'resource';
export const RESOURCE_ID_PARAM = 'resourceIdParam';

export const RequireOwnership = (resource: string, resourceIdParam: string = 'id') => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(RESOURCE_KEY, resource)(target, propertyKey, descriptor);
    SetMetadata(RESOURCE_ID_PARAM, resourceIdParam)(target, propertyKey, descriptor);
  };
};
