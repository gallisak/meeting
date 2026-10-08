import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SafeUser } from '../users/users.service.js';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

const NOW = new Date('2026-10-20T08:00:00.000Z');
const ROOM_ID = '7b1f6c1e-3d0a-4a53-9a5e-2f4f3f1f0c11';
const BOOKING_ID = '2c0e4a51-8a57-4c8e-9c7e-5b1d1a2f3e44';

const at = (time: string) => `2026-10-20T${time}:00.000Z`;

const user = (id: string, role: SafeUser['role'] = 'MEMBER'): SafeUser => ({
  id,
  email: `${id}@test.local`,
  name: id,
  role,
  createdAt: NOW,
  updatedAt: NOW,
});

const owner = user('owner');
const stranger = user('stranger');
const admin = user('admin', 'ADMIN');

const room = { id: ROOM_ID, capacity: 4, isActive: true };

const booking = {
  id: BOOKING_ID,
  title: 'Sprint planning',
  startsAt: new Date(at('10:00')),
  endsAt: new Date(at('11:00')),
  status: 'CONFIRMED',
  attendeesCount: 2,
  userId: owner.id,
  roomId: ROOM_ID,
};

const dto = {
  roomId: ROOM_ID,
  title: 'Sprint planning',
  startsAt: at('10:00'),
  endsAt: at('11:00'),
  attendeesCount: 2,
} satisfies CreateBookingDto;

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

describe('BookingsService', () => {
  const tx = {
    $queryRaw: vi.fn(),
    booking: { create: vi.fn(), update: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(),
    booking: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    room: { findUnique: vi.fn() },
  };
  const service = new BookingsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);

    prisma.$transaction.mockImplementation(
      (work: ((client: typeof tx) => unknown) | Promise<unknown>[]) =>
        typeof work === 'function' ? work(tx) : Promise.all(work),
    );
    tx.$queryRaw.mockResolvedValue([room]);
    tx.booking.create.mockResolvedValue(booking);
    tx.booking.update.mockResolvedValue(booking);
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.booking.findMany.mockResolvedValue([booking]);
    prisma.booking.count.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('creates a booking for the current user', async () => {
      await expect(service.create(owner.id, dto)).resolves.toBe(booking);

      expect(tx.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            title: dto.title,
            startsAt: new Date(dto.startsAt),
            endsAt: new Date(dto.endsAt),
            attendeesCount: 2,
            userId: owner.id,
            roomId: ROOM_ID,
          },
        }),
      );
    });

    it('rejects an invalid period before any query', async () => {
      await expect(
        service.create(owner.id, { ...dto, endsAt: at('10:10') }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create(owner.id, { ...dto, startsAt: at('07:00') }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown room', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      await expect(service.create(owner.id, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(tx.booking.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive room', async () => {
      tx.$queryRaw.mockResolvedValue([{ ...room, isActive: false }]);

      await expect(service.create(owner.id, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.booking.create).not.toHaveBeenCalled();
    });

    it('allows attendees up to the room capacity and rejects more', async () => {
      await expect(
        service.create(owner.id, { ...dto, attendeesCount: 4 }),
      ).resolves.toBe(booking);
      await expect(
        service.create(owner.id, { ...dto, attendeesCount: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.booking.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('write errors', () => {
    it('retries once after a deadlock', async () => {
      prisma.$transaction
        .mockRejectedValueOnce(deadlock())
        .mockResolvedValueOnce(booking);

      await expect(service.create(owner.id, dto)).resolves.toBe(booking);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('answers 409 when the retry hits a deadlock too', async () => {
      prisma.$transaction.mockRejectedValue(deadlock());

      await expect(service.create(owner.id, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('answers 409 when the retry finds the slot taken', async () => {
      prisma.$transaction
        .mockRejectedValueOnce(deadlock())
        .mockRejectedValueOnce(overlap());

      await expect(service.create(owner.id, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('answers 409 on an overlap without a retry', async () => {
      tx.booking.create.mockRejectedValue(overlap());

      await expect(service.create(owner.id, dto)).rejects.toThrow(
        'Room is already booked for this time',
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('passes other errors through without a retry', async () => {
      const error = new Error('connection lost');
      prisma.$transaction.mockRejectedValue(error);

      await expect(service.create(owner.id, dto)).rejects.toBe(error);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('shows a member only their own bookings', async () => {
      await service.findAll(owner, {});

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: owner.id } }),
      );
      expect(prisma.booking.count).toHaveBeenCalledWith({
        where: { userId: owner.id },
      });
    });

    it('shows an admin every booking', async () => {
      await service.findAll(admin, {});

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('applies room, status, period and pagination', async () => {
      const result = await service.findAll(admin, {
        roomId: ROOM_ID,
        status: 'CANCELLED',
        from: at('09:00'),
        to: at('12:00'),
        page: 3,
        limit: 20,
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            roomId: ROOM_ID,
            status: 'CANCELLED',
            endsAt: { gt: new Date(at('09:00')) },
            startsAt: { lt: new Date(at('12:00')) },
          },
          skip: 40,
          take: 20,
        }),
      );
      expect(result).toEqual({
        items: [booking],
        total: 1,
        page: 3,
        limit: 20,
      });
    });

    it('rejects a period that ends before it starts', async () => {
      await expect(
        service.findAll(admin, { from: at('12:00'), to: at('09:00') }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('returns the booking to its owner and to an admin', async () => {
      await expect(service.findOne(owner, BOOKING_ID)).resolves.toBe(booking);
      await expect(service.findOne(admin, BOOKING_ID)).resolves.toBe(booking);
    });

    it('hides the booking from another member', async () => {
      await expect(
        service.findOne(stranger, BOOKING_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('answers 404 for an unknown booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.findOne(owner, BOOKING_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('renames a booking without locking the room', async () => {
      await service.update(owner, BOOKING_ID, { title: 'Renamed' });

      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(tx.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BOOKING_ID, status: 'CONFIRMED' },
          data: {
            title: 'Renamed',
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
          },
        }),
      );
    });

    it('renames a booking that has already started', async () => {
      vi.setSystemTime(new Date(at('10:30')));

      await expect(
        service.update(owner, BOOKING_ID, { title: 'Renamed' }),
      ).resolves.toBe(booking);
    });

    it('locks the room when the time changes', async () => {
      await service.update(owner, BOOKING_ID, { endsAt: at('12:00') });

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            title: undefined,
            startsAt: booking.startsAt,
            endsAt: new Date(at('12:00')),
          },
        }),
      );
    });

    it('validates the new period', async () => {
      await expect(
        service.update(owner, BOOKING_ID, { endsAt: at('10:05') }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.update(owner, BOOKING_ID, { startsAt: at('07:00') }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a new time in an inactive room', async () => {
      tx.$queryRaw.mockResolvedValue([{ ...room, isActive: false }]);

      await expect(
        service.update(owner, BOOKING_ID, { endsAt: at('12:00') }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.booking.update).not.toHaveBeenCalled();
    });

    it('rejects a change of a cancelled booking', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...booking,
        status: 'CANCELLED',
      });

      await expect(
        service.update(owner, BOOKING_ID, { title: 'Renamed' }),
      ).rejects.toThrow('Cancelled booking cannot be changed');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('answers 409 when the booking is cancelled during the update', async () => {
      tx.booking.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: Prisma.prismaVersion.client,
        }),
      );

      await expect(
        service.update(owner, BOOKING_ID, { title: 'Renamed' }),
      ).rejects.toThrow('Cancelled booking cannot be changed');
    });

    it('answers 409 when the new time is taken', async () => {
      tx.booking.update.mockRejectedValue(overlap());

      await expect(
        service.update(owner, BOOKING_ID, { endsAt: at('12:00') }),
      ).rejects.toThrow('Room is already booked for this time');
    });

    it('does not let another member change the booking', async () => {
      await expect(
        service.update(stranger, BOOKING_ID, { title: 'Renamed' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('marks the booking as cancelled and keeps the record', async () => {
      const cancelled = { ...booking, status: 'CANCELLED' };
      prisma.booking.update.mockResolvedValue(cancelled);

      await expect(service.cancel(owner, BOOKING_ID)).resolves.toBe(cancelled);
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BOOKING_ID },
          data: { status: 'CANCELLED' },
        }),
      );
    });

    it('lets an admin cancel a booking of another user', async () => {
      await service.cancel(admin, BOOKING_ID);

      expect(prisma.booking.update).toHaveBeenCalledTimes(1);
    });

    it('does not let another member cancel the booking', async () => {
      await expect(service.cancel(stranger, BOOKING_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('returns an already cancelled booking without a write', async () => {
      const cancelled = { ...booking, status: 'CANCELLED' };
      prisma.booking.findUnique.mockResolvedValue(cancelled);

      await expect(service.cancel(owner, BOOKING_ID)).resolves.toBe(cancelled);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });
  });

  describe('getAvailability', () => {
    beforeEach(() => {
      prisma.room.findUnique.mockResolvedValue({ id: ROOM_ID, isActive: true });
      prisma.booking.findMany.mockResolvedValue([
        { startsAt: booking.startsAt, endsAt: booking.endsAt },
      ]);
    });

    it('returns the free slots of a future day', async () => {
      const result = await service.getAvailability(ROOM_ID, '2026-10-21');

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            roomId: ROOM_ID,
            status: 'CONFIRMED',
            startsAt: { lt: new Date('2026-10-22T00:00:00.000Z') },
            endsAt: { gt: new Date('2026-10-21T00:00:00.000Z') },
          },
        }),
      );
      expect(result.roomId).toBe(ROOM_ID);
      expect(result.date).toBe('2026-10-21');
    });

    it('starts today from the current time', async () => {
      const result = await service.getAvailability(ROOM_ID, '2026-10-20');

      expect(result.slots).toEqual([
        { startsAt: NOW, endsAt: booking.startsAt },
        {
          startsAt: booking.endsAt,
          endsAt: new Date('2026-10-21T00:00:00.000Z'),
        },
      ]);
    });

    it('returns no slots for a past day', async () => {
      const result = await service.getAvailability(ROOM_ID, '2026-10-19');

      expect(result.slots).toEqual([]);
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });

    it('returns no slots for an inactive room', async () => {
      prisma.room.findUnique.mockResolvedValue({
        id: ROOM_ID,
        isActive: false,
      });

      const result = await service.getAvailability(ROOM_ID, '2026-10-21');

      expect(result.slots).toEqual([]);
    });

    it('answers 404 for an unknown room', async () => {
      prisma.room.findUnique.mockResolvedValue(null);

      await expect(
        service.getAvailability(ROOM_ID, '2026-10-21'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
