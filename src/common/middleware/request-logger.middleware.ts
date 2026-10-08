import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

const REQUEST_ID_FORMAT = /^[\w-]{1,64}$/;

const logger = new Logger('HTTP');

type RequestWithUser = Request & { user?: { id?: string } };

export function requestLogger(
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
) {
  const startedAt = Date.now();
  const incomingId = req.header(REQUEST_ID_HEADER);
  const requestId =
    incomingId && REQUEST_ID_FORMAT.test(incomingId)
      ? incomingId
      : randomUUID();

  res.setHeader(REQUEST_ID_HEADER, requestId);

  res.on('finish', () => {
    const entry = {
      message: 'request completed',
      requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?.id,
    };

    if (res.statusCode >= 500) {
      logger.error(entry);
    } else if (res.statusCode >= 400) {
      logger.warn(entry);
    } else {
      logger.log(entry);
    }
  });

  next();
}
