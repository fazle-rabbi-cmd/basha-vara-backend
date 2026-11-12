import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

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
  await app.listen(port);
  logger.log(`🚀 Basha Vara Backend listening on http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger OpenAPI documentation available at http://localhost:${port}/api/docs`);
}

await bootstrap();
