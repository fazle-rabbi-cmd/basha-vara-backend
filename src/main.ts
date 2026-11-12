import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Starting Basha Vara Backend...');

  const app = await NestFactory.create(AppModule);
  logger.log('NestJS application created successfully');

  // Cookie parser middleware for HttpOnly auth cookies
  app.use(cookieParser());

  // Global API Versioning Prefix
  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Global Strict Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Exception Handling Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS Configuration
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  });

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Basha Vara API')
    .setDescription(
      'REST API documentation for Basha Vara — Mobile-first rental housing marketplace for Bangladesh.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Health', 'System and database health telemetry')
    .addTag('Auth', 'Authentication, registration, sessions, and profile endpoints')
    .addTag('Properties', 'Public property catalog and landlord listing management')
    .addTag('Visits', 'Physical property visit requests and scheduling')
    .addTag('Applications', 'Rental application review and shortlisted candidate workflows')
    .addTag('Admin', 'Platform governance, user management, and property moderation')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ?? 4000;
  logger.log(`Attempting to bind to port ${port} on 0.0.0.0...`);
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Basha Vara Backend listening on http://0.0.0.0:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger OpenAPI documentation available at http://0.0.0.0:${port}/api/docs`);
}

bootstrap().catch((error) => {
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
