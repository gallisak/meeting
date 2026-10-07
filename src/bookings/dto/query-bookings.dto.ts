import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import {
  ISO_WITH_TIMEZONE,
  ISO_WITH_TIMEZONE_MESSAGE,
} from './create-booking.dto.js';

export class QueryBookingsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by room ID' })
  @IsUUID('4')
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Only bookings that end after this moment',
    example: '2026-10-20T00:00:00Z',
  })
  @IsISO8601({ strict: true })
  @Matches(ISO_WITH_TIMEZONE, { message: `from ${ISO_WITH_TIMEZONE_MESSAGE}` })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'Only bookings that start before this moment',
    example: '2026-10-21T00:00:00Z',
  })
  @IsISO8601({ strict: true })
  @Matches(ISO_WITH_TIMEZONE, { message: `to ${ISO_WITH_TIMEZONE_MESSAGE}` })
  @IsOptional()
  to?: string;
}
