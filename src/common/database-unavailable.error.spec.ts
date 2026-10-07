import { Prisma } from '@prisma/client';
import { isDatabaseUnavailableError } from './database-unavailable.error.js';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('Database error', {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });

describe('isDatabaseUnavailableError', () => {
  it('recognises an unreachable database', () => {
    expect(isDatabaseUnavailableError(knownError('P1001'))).toBe(true);
  });

  it('recognises a connection closed by the database', () => {
    expect(isDatabaseUnavailableError(knownError('P1017'))).toBe(true);
  });

  it('recognises a connection pool timeout', () => {
    expect(isDatabaseUnavailableError(knownError('P2024'))).toBe(true);
  });

  it('recognises a transaction timeout', () => {
    expect(isDatabaseUnavailableError(knownError('P2028'))).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isDatabaseUnavailableError(knownError('P2002'))).toBe(false);
    expect(isDatabaseUnavailableError(knownError('P2025'))).toBe(false);
    expect(isDatabaseUnavailableError(new Error('P1001'))).toBe(false);
    expect(isDatabaseUnavailableError(null)).toBe(false);
  });
});
