import { Prisma } from '@prisma/client';

export const DATABASE_BUSY_MESSAGE = 'Server is busy, try again later';

const POOL_TIMEOUT_CODE = 'P2024';
const TRANSACTION_TIMEOUT_CODE = 'P2028';

export function isDatabaseBusyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === POOL_TIMEOUT_CODE ||
      error.code === TRANSACTION_TIMEOUT_CODE)
  );
}
