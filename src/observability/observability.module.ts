import { Module, MiddlewareConsumer, NestModule, Injectable, NestInterceptor, ExecutionContext, CallHandler, ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

export class RequestIdMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string || randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = request.headers['x-request-id'] as string;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        const logLevel = statusCode >= 400 ? 'error' : 'info';

        console.log(JSON.stringify({
          level: logLevel,
          requestId,
          method: request.method,
          url: request.url,
          statusCode,
          duration,
          timestamp: new Date().toISOString(),
        }));
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        console.error(JSON.stringify({
          level: 'error',
          requestId,
          method: request.method,
          url: request.url,
          statusCode,
          duration,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        }));

        return throwError(() => error);
      }),
    );
  }
}

@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.headers['x-request-id'] as string;

    const status = exception.status || 500;
    const message = exception.message || 'Internal server error';

    console.error(JSON.stringify({
      level: 'error',
      requestId,
      method: request.method,
      url: request.url,
      statusCode: status,
      error: message,
      stack: exception.stack,
      timestamp: new Date().toISOString(),
    }));

    response.status(status).json({
      statusCode: status,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV !== 'production' ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
          },
        } : undefined,
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            headers: req.headers,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
        customProps: (req, res) => ({
          requestId: req.headers['x-request-id'],
        }),
      },
    }),
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
