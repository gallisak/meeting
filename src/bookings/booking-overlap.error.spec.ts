import { Prisma } from '@prisma/client';
import {
  isBookingOverlapError,
  isDeadlockError,
} from './booking-overlap.error.js';

const OVERLAP_MESSAGE = `
Invalid \`prisma.booking.create()\` invocation:

Error occurred during query execution:
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "23P01", message: "conflicting key value violates exclusion constraint \\"bookings_no_overlap\\"", severity: "ERROR", detail: None, column: None, hint: None }), transient: false })`;

const DEADLOCK_MESSAGE = `
Invalid \`prisma.booking.create()\` invocation:

Error occurred during query execution:
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "40P01", message: "deadlock detected", severity: "ERROR", detail: None, column: None, hint: Some("See server log for query details.") }), transient: false })`;

const CHECK_MESSAGE = `
Invalid \`prisma.booking.create()\` invocation:

Error occurred during query execution:
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "23514", message: "new row for relation \\"bookings\\" violates check constraint \\"bookings_period_check\\"", severity: "ERROR", detail: None, column: None, hint: None }), transient: false })`;

const unknownError = (message: string) =>
  new Prisma.PrismaClientUnknownRequestError(message, {
    clientVersion: Prisma.prismaVersion.client,
  });

describe('booking database errors', () => {
  it('recognises the exclusion constraint violation', () => {
    const error = unknownError(OVERLAP_MESSAGE);

    expect(isBookingOverlapError(error)).toBe(true);
    expect(isDeadlockError(error)).toBe(false);
  });

  it('recognises a deadlock', () => {
    const error = unknownError(DEADLOCK_MESSAGE);

    expect(isDeadlockError(error)).toBe(true);
    expect(isBookingOverlapError(error)).toBe(false);
  });

  it('ignores other database errors', () => {
    const error = unknownError(CHECK_MESSAGE);

    expect(isBookingOverlapError(error)).toBe(false);
    expect(isDeadlockError(error)).toBe(false);
  });

  it('ignores errors that are not Prisma request errors', () => {
    const uniqueViolation = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: Prisma.prismaVersion.client },
    );

    for (const error of [
      new Error(OVERLAP_MESSAGE),
      new Error(DEADLOCK_MESSAGE),
      uniqueViolation,
      null,
    ]) {
      expect(isBookingOverlapError(error)).toBe(false);
      expect(isDeadlockError(error)).toBe(false);
    }
  });
});
