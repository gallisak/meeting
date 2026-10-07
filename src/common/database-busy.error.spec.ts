import { Prisma } from '@prisma/client';
import { isDatabaseBusyError } from './database-busy.error.js';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('Database error', {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });

describe('isDatabaseBusyError', () => {
  it('recognises a connection pool timeout', () => {
    expect(isDatabaseBusyError(knownError('P2024'))).toBe(true);
  });

  it('recognises a transaction timeout', () => {
    expect(isDatabaseBusyError(knownError('P2028'))).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isDatabaseBusyError(knownError('P2002'))).toBe(false);
    expect(isDatabaseBusyError(knownError('P2025'))).toBe(false);
    expect(isDatabaseBusyError(new Error('P2028'))).toBe(false);
    expect(isDatabaseBusyError(null)).toBe(false);
  });
});
