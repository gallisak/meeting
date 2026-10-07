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
import { assertValidBookingPeriod } from './booking-rules.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { QueryBookingsDto } from './dto/query-bookings.dto.js';

const BOOKING_INCLUDE = {
  room: { select: { id: true, name: true, floor: true, capacity: true } },
  user: { select: { id: true, email: true, name: true } },
} as const;

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBookingDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    assertValidBookingPeriod(startsAt, endsAt, new Date());

    const room = await this.prisma.room.findUnique({
      where: { id: dto.roomId },
      select: { id: true, capacity: true, isActive: true },
    });

    if (!room) {
      throw new NotFoundException(`Room id: "${dto.roomId}" not found`);
    }

    if (!room.isActive) {
      throw new ConflictException('Room is not active and cannot be booked');
    }

    if (dto.attendeesCount > room.capacity) {
      throw new BadRequestException(
        `attendeesCount must not exceed room capacity (${room.capacity})`,
      );
    }

    const overlapping = await this.prisma.booking.findFirst({
      where: {
        roomId: room.id,
        status: BookingStatus.CONFIRMED,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new ConflictException('Room is already booked for this time');
    }

    return this.prisma.booking.create({
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
}
