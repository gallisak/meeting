import { Prisma } from '@prisma/client';

export const DATABASE_UNAVAILABLE_MESSAGE =
  'Service is temporarily unavailable, try again later';

const DATABASE_UNAVAILABLE_CODES = new Set([
  'P1001',
  'P1017',
  'P2024',
  'P2028',
]);

export function isDatabaseUnavailableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    DATABASE_UNAVAILABLE_CODES.has(error.code)
  );
}
