import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailableError,
} from '../database-unavailable.error.js';
import { REQUEST_ID_HEADER } from '../middleware/request-logger.middleware.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const where = `${request.method} ${request.url}, request ${String(response.getHeader(REQUEST_ID_HEADER))}`;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null && 'message' in res) {
        message = (res as { message: string | object }).message;
      } else {
        message = res;
      }

      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(`HTTP ${status} on ${where}`, exception.stack);
      }
    } else if (this.isClientError(exception)) {
      status = exception.statusCode;
      message = exception.message;
    } else if (isDatabaseUnavailableError(exception)) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = DATABASE_UNAVAILABLE_MESSAGE;
      this.logger.error(
        `Database is unavailable on ${where}`,
        exception instanceof Error ? exception.message : String(exception),
      );
    } else {
      this.logger.error(
        `Unhandled exception on ${where}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }

  private isClientError(
    exception: unknown,
  ): exception is { statusCode: number; message: string } {
    if (typeof exception !== 'object' || exception === null) {
      return false;
    }

    const { statusCode, message } = exception as Record<string, unknown>;

    return (
      typeof statusCode === 'number' &&
      statusCode >= 400 &&
      statusCode < 500 &&
      typeof message === 'string'
    );
  }
}
