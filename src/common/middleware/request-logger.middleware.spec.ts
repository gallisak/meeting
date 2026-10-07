import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { Request, Response } from 'express';
import { requestLogger } from './request-logger.middleware.js';

const run = (statusCode: number, user?: { id: string }) => {
  const req = {
    method: 'POST',
    originalUrl: '/bookings?page=2',
    header: () => 'request-1',
    user,
  } as unknown as Request;
  const res = Object.assign(new EventEmitter(), {
    statusCode,
    setHeader: vi.fn(),
  });
  const next = vi.fn();

  requestLogger(req, res as unknown as Response, next);
  res.emit('finish');

  return { res, next };
};

describe('requestLogger', () => {
  const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  const error = vi
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs one entry with the request details', () => {
    const { res, next } = run(201, { id: 'user-1' });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'request-1');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({
      message: 'request completed',
      requestId: 'request-1',
      method: 'POST',
      path: '/bookings',
      statusCode: 201,
      durationMs: expect.any(Number),
      userId: 'user-1',
    });
  });

  it('logs client errors as warnings and server errors as errors', () => {
    run(409);
    run(503);

    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
