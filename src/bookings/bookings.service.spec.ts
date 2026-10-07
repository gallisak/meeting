import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

const HOUR = 60 * 60 * 1000;

const databaseError = (message: string) =>
  new Prisma.PrismaClientUnknownRequestError(message, {
    clientVersion: Prisma.prismaVersion.client,
  });

const deadlock = () =>
  databaseError(
    'PostgresError { code: "40P01", message: "deadlock detected" }',
  );

const overlap = () =>
  databaseError(
    'PostgresError { code: "23P01", message: "conflicting key value violates exclusion constraint \\"bookings_no_overlap\\"" }',
  );

describe('BookingsService write errors', () => {
  const transaction = vi.fn();
  const service = new BookingsService({
    $transaction: transaction,
  } as unknown as PrismaService);

  const dto: CreateBookingDto = {
    roomId: '7b1f6c1e-3d0a-4a53-9a5e-2f4f3f1f0c11',
    title: 'Sprint planning',
    startsAt: new Date(Date.now() + HOUR).toISOString(),
    endsAt: new Date(Date.now() + 2 * HOUR).toISOString(),
    attendeesCount: 2,
  };

  beforeEach(() => {
    transaction.mockReset();
  });

  it('retries once after a deadlock', async () => {
    const booking = { id: 'booking-id' };
    transaction
      .mockRejectedValueOnce(deadlock())
      .mockResolvedValueOnce(booking);

    await expect(service.create('user-id', dto)).resolves.toBe(booking);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('answers 409 when the retry hits a deadlock too', async () => {
    transaction.mockRejectedValue(deadlock());

    await expect(service.create('user-id', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('answers 409 when the retry finds the slot taken', async () => {
    transaction
      .mockRejectedValueOnce(deadlock())
      .mockRejectedValueOnce(overlap());

    await expect(service.create('user-id', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('answers 409 on an overlap without a retry', async () => {
    transaction.mockRejectedValue(overlap());

    await expect(service.create('user-id', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('passes other errors through without a retry', async () => {
    const error = new Error('connection lost');
    transaction.mockRejectedValue(error);

    await expect(service.create('user-id', dto)).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
