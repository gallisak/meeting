import { BadRequestException } from '@nestjs/common';
import { assertValidBookingPeriod, findFreeSlots } from './booking-rules.js';

const MINUTE = 60 * 1000;
const NOW = new Date('2026-10-20T08:00:00.000Z');

const at = (time: string) => new Date(`2026-10-20T${time}:00.000Z`);

describe('assertValidBookingPeriod', () => {
  it('accepts a one hour booking in the future', () => {
    expect(() =>
      assertValidBookingPeriod(at('10:00'), at('11:00'), NOW),
    ).not.toThrow();
  });

  it('rejects an end that is not after the start', () => {
    expect(() =>
      assertValidBookingPeriod(at('11:00'), at('10:00'), NOW),
    ).toThrow(BadRequestException);
    expect(() =>
      assertValidBookingPeriod(at('10:00'), at('10:00'), NOW),
    ).toThrow('startsAt must be earlier than endsAt');
  });

  it('accepts exactly 15 minutes and rejects less', () => {
    expect(() =>
      assertValidBookingPeriod(at('10:00'), at('10:15'), NOW),
    ).not.toThrow();
    expect(() =>
      assertValidBookingPeriod(at('10:00'), at('10:14'), NOW),
    ).toThrow('Booking must last at least 15 minutes');
  });

  it('accepts exactly 8 hours and rejects more', () => {
    expect(() =>
      assertValidBookingPeriod(at('10:00'), at('18:00'), NOW),
    ).not.toThrow();
    expect(() =>
      assertValidBookingPeriod(at('10:00'), at('18:01'), NOW),
    ).toThrow('Booking must not last longer than 8 hours');
  });

  it('rejects a start in the past and accepts a start right now', () => {
    const justBefore = new Date(NOW.getTime() - 1);

    expect(() =>
      assertValidBookingPeriod(justBefore, at('09:00'), NOW),
    ).toThrow('Booking must not start in the past');
    expect(() => assertValidBookingPeriod(NOW, at('09:00'), NOW)).not.toThrow();
  });
});

describe('findFreeSlots', () => {
  const from = at('08:00');
  const to = at('18:00');

  it('returns the whole period when nothing is booked', () => {
    expect(findFreeSlots(from, to, [])).toEqual([
      { startsAt: from, endsAt: to },
    ]);
  });

  it('returns the gaps around bookings', () => {
    const busy = [
      { startsAt: at('10:00'), endsAt: at('11:00') },
      { startsAt: at('13:00'), endsAt: at('14:00') },
    ];

    expect(findFreeSlots(from, to, busy)).toEqual([
      { startsAt: at('08:00'), endsAt: at('10:00') },
      { startsAt: at('11:00'), endsAt: at('13:00') },
      { startsAt: at('14:00'), endsAt: at('18:00') },
    ]);
  });

  it('has no gap between adjacent bookings', () => {
    const busy = [
      { startsAt: at('08:00'), endsAt: at('12:00') },
      { startsAt: at('12:00'), endsAt: at('18:00') },
    ];

    expect(findFreeSlots(from, to, busy)).toEqual([]);
  });

  it('drops gaps shorter than the minimum booking', () => {
    const busy = [
      { startsAt: at('08:10'), endsAt: at('12:00') },
      { startsAt: at('12:14'), endsAt: at('17:50') },
    ];

    expect(findFreeSlots(from, to, busy)).toEqual([]);
  });

  it('keeps a gap of exactly the minimum booking', () => {
    const busy = [{ startsAt: at('08:15'), endsAt: at('18:00') }];

    expect(findFreeSlots(from, to, busy)).toEqual([
      { startsAt: at('08:00'), endsAt: at('08:15') },
    ]);
  });

  it('handles a booking that started before the period', () => {
    const busy = [
      { startsAt: new Date(from.getTime() - 60 * MINUTE), endsAt: at('09:00') },
    ];

    expect(findFreeSlots(from, to, busy)).toEqual([
      { startsAt: at('09:00'), endsAt: at('18:00') },
    ]);
  });
});
