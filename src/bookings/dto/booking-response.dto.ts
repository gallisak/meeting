import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';

export class BookingRoomDto {
  @ApiProperty({ example: '7b1f6c1e-3d0a-4a53-9a5e-2f4f3f1f0c11' })
  id!: string;

  @ApiProperty({ example: 'Large room' })
  name!: string;

  @ApiProperty({ example: 4 })
  floor!: number;

  @ApiProperty({ example: 20 })
  capacity!: number;
}

export class BookingUserDto {
  @ApiProperty({ example: 'c56a4180-65aa-42ec-a945-5fd21dec0538' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Andrii' })
  name!: string;
}

export class BookingResponseDto {
  @ApiProperty({ example: '0b6f0a52-6d0e-4c0b-9a39-5b1f3b6f2a10' })
  id!: string;

  @ApiProperty({ example: 'Sprint planning' })
  title!: string;

  @ApiProperty({ example: '2026-10-20T10:00:00.000Z' })
  startsAt!: Date;

  @ApiProperty({ example: '2026-10-20T11:00:00.000Z' })
  endsAt!: Date;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.CONFIRMED })
  status!: BookingStatus;

  @ApiProperty({ example: 6 })
  attendeesCount!: number;

  @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ example: 'c56a4180-65aa-42ec-a945-5fd21dec0538' })
  userId!: string;

  @ApiProperty({ example: '7b1f6c1e-3d0a-4a53-9a5e-2f4f3f1f0c11' })
  roomId!: string;

  @ApiProperty({ type: BookingRoomDto })
  room!: BookingRoomDto;

  @ApiProperty({ type: BookingUserDto })
  user!: BookingUserDto;
}

export class PaginatedBookingsResponseDto {
  @ApiProperty({ type: [BookingResponseDto] })
  items!: BookingResponseDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;
}
