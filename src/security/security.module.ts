import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { SecurityMiddleware } from './security.middleware.js';

@Module({
  providers: [SecurityMiddleware],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
