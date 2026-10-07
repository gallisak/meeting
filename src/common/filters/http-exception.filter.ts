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
  DATABASE_BUSY_MESSAGE,
  isDatabaseBusyError,
} from '../database-busy.error.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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
        this.logger.error(
          `HTTP ${status} on ${request.method} ${request.url}`,
          exception.stack,
        );
      }
    } else if (this.isClientError(exception)) {
      status = exception.statusCode;
      message = exception.message;
    } else if (isDatabaseBusyError(exception)) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = DATABASE_BUSY_MESSAGE;
      this.logger.warn(`Database is busy on ${request.method} ${request.url}`);
    } else {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
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
