import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SafeUser } from '../users/users.service.js';
import {
  BOOKING_OVERLAP_MESSAGE,
  isBookingOverlapError,
  isDeadlockError,
} from './booking-overlap.error.js';
import { assertValidBookingPeriod, findFreeSlots } from './booking-rules.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { QueryBookingsDto } from './dto/query-bookings.dto.js';
import { UpdateBookingDto } from './dto/update-booking.dto.js';

const BOOKING_INCLUDE = {
  room: { select: { id: true, name: true, floor: true, capacity: true } },
  user: { select: { id: true, email: true, name: true } },
} as const;

const CANCELLED_BOOKING_MESSAGE = 'Cancelled booking cannot be changed';
const INACTIVE_ROOM_MESSAGE = 'Room is not active and cannot be booked';

type LockedRoom = { id: string; capacity: number; isActive: boolean };

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBookingDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    assertValidBookingPeriod(startsAt, endsAt, new Date());

    return this.writeBooking(() =>
      this.prisma.$transaction(async (tx) => {
        const room = await this.lockRoom(tx, dto.roomId);

        if (!room) {
          throw new NotFoundException(`Room id: "${dto.roomId}" not found`);
        }

        if (!room.isActive) {
          throw new ConflictException(INACTIVE_ROOM_MESSAGE);
        }

        if (dto.attendeesCount > room.capacity) {
          throw new BadRequestException(
            `attendeesCount must not exceed room capacity (${room.capacity})`,
          );
        }

        return tx.booking.create({
          data: {
            title: dto.title,
            startsAt,
            endsAt,
            attendeesCount: dto.attendeesCount,
            userId,
            roomId: room.id,
          },
          include: BOOKING_INCLUDE,
        });
      }),
    );
  }

  async findAll(user: SafeUser, query: QueryBookingsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    if (from && to && from >= to) {
      throw new BadRequestException('from must be earlier than to');
    }

    const where: Prisma.BookingWhereInput = {};

    if (user.role !== Role.ADMIN) {
      where.userId = user.id;
    }

    if (query.roomId) {
      where.roomId = query.roomId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (from) {
      where.endsAt = { gt: from };
    }

    if (to) {
      where.startsAt = { lt: to };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        include: BOOKING_INCLUDE,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findOne(user: SafeUser, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      throw new NotFoundException(`Booking id: "${id}" not found`);
    }

    if (booking.userId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Access denied: not the booking owner');
    }

    return booking;
  }

  async update(user: SafeUser, id: string, dto: UpdateBookingDto) {
    const booking = await this.findOne(user, id);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new ConflictException(CANCELLED_BOOKING_MESSAGE);
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : booking.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : booking.endsAt;

    const periodChanged =
      startsAt.getTime() !== booking.startsAt.getTime() ||
      endsAt.getTime() !== booking.endsAt.getTime();

    if (periodChanged) {
      assertValidBookingPeriod(startsAt, endsAt, new Date());
    }

    try {
      return await this.writeBooking(() =>
        this.prisma.$transaction(async (tx) => {
          if (periodChanged) {
            const room = await this.lockRoom(tx, booking.roomId);

            if (!room?.isActive) {
              throw new ConflictException(INACTIVE_ROOM_MESSAGE);
            }
          }

          return tx.booking.update({
            where: { id, status: BookingStatus.CONFIRMED },
            data: { title: dto.title, startsAt, endsAt },
            include: BOOKING_INCLUDE,
          });
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ConflictException(CANCELLED_BOOKING_MESSAGE);
      }
      throw error;
    }
  }

  async cancel(user: SafeUser, id: string) {
    const booking = await this.findOne(user, id);

    if (booking.status === BookingStatus.CANCELLED) {
      return booking;
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
      include: BOOKING_INCLUDE,
    });
  }

  async getAvailability(roomId: string, date: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, isActive: true },
    });

    if (!room) {
      throw new NotFoundException(`Room id: "${roomId}" not found`);
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const nextMinute = new Date(Math.ceil(Date.now() / MINUTE_MS) * MINUTE_MS);
    const from = dayStart > nextMinute ? dayStart : nextMinute;

    if (!room.isActive || from >= dayEnd) {
      return { roomId, date, slots: [] };
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        roomId,
        status: BookingStatus.CONFIRMED,
        startsAt: { lt: dayEnd },
        endsAt: { gt: from },
      },
      orderBy: { startsAt: 'asc' },
      select: { startsAt: true, endsAt: true },
    });

    return { roomId, date, slots: findFreeSlots(from, dayEnd, bookings) };
  }

  private async lockRoom(tx: Prisma.TransactionClient, roomId: string) {
    const rooms = await tx.$queryRaw<LockedRoom[]>`
      SELECT "id", "capacity", "isActive" FROM "rooms"
      WHERE "id" = ${roomId}
      FOR UPDATE
    `;

    return rooms[0];
  }

  private async writeBooking<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await this.retryOnDeadlock(write);
    } catch (error) {
      if (isBookingOverlapError(error) || isDeadlockError(error)) {
        throw new ConflictException(BOOKING_OVERLAP_MESSAGE);
      }
      throw error;
    }
  }

  private async retryOnDeadlock<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (!isDeadlockError(error)) {
        throw error;
      }
      return write();
    }
  }
}
