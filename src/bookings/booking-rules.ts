import { BadRequestException } from '@nestjs/common';

export const MIN_BOOKING_DURATION_MS = 15 * 60 * 1000;
export const MAX_BOOKING_DURATION_MS = 8 * 60 * 60 * 1000;

export function assertValidBookingPeriod(
  startsAt: Date,
  endsAt: Date,
  now: Date,
): void {
  if (startsAt >= endsAt) {
    throw new BadRequestException('startsAt must be earlier than endsAt');
  }

  const duration = endsAt.getTime() - startsAt.getTime();

  if (duration < MIN_BOOKING_DURATION_MS) {
    throw new BadRequestException('Booking must last at least 15 minutes');
  }

  if (duration > MAX_BOOKING_DURATION_MS) {
    throw new BadRequestException('Booking must not last longer than 8 hours');
  }

  if (startsAt < now) {
    throw new BadRequestException('Booking must not start in the past');
  }
}

export type TimeSlot = { startsAt: Date; endsAt: Date };

export function findFreeSlots(
  from: Date,
  to: Date,
  busySlots: TimeSlot[],
): TimeSlot[] {
  const freeSlots: TimeSlot[] = [];
  let cursor = from;

  for (const busy of busySlots) {
    if (busy.startsAt.getTime() - cursor.getTime() >= MIN_BOOKING_DURATION_MS) {
      freeSlots.push({ startsAt: cursor, endsAt: busy.startsAt });
    }
    if (busy.endsAt > cursor) {
      cursor = busy.endsAt;
    }
  }

  if (to.getTime() - cursor.getTime() >= MIN_BOOKING_DURATION_MS) {
    freeSlots.push({ startsAt: cursor, endsAt: to });
  }

  return freeSlots;
}
