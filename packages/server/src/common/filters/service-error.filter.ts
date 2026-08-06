import { Catch, HttpStatus } from '@nestjs/common';
import type { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { ServiceError } from '@/modules/Items/ServiceError';

@Catch(ServiceError)
export class ServiceErrorFilter implements ExceptionFilter {
  catch(exception: ServiceError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    response.status(status).json({
      errors: [
        {
          statusCode: status,
          type: exception.errorType,
          message: exception.message,
          payload: exception.payload,
        },
      ],
    });
  }
}
