import { Prisma } from '@prisma/client';

export const BOOKING_OVERLAP_CONSTRAINT = 'bookings_no_overlap';
export const BOOKING_OVERLAP_MESSAGE = 'Room is already booked for this time';

const POSTGRES_DEADLOCK_CODE = '40P01';

export function isBookingOverlapError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    error.message.includes(BOOKING_OVERLAP_CONSTRAINT)
  );
}

export function isDeadlockError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    error.message.includes(POSTGRES_DEADLOCK_CODE)
  );
}
