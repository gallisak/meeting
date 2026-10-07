import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  NotContains,
} from 'class-validator';
import { Trim } from '../../common/transforms/trim.transform.js';
import { MAX_ROOM_CAPACITY } from '../../rooms/dto/create-room.dto.js';

export const ISO_WITH_TIMEZONE = /(Z|[+-]\d{2}:\d{2})$/;
export const ISO_WITH_TIMEZONE_MESSAGE =
  'must include a time and a timezone, for example 2026-10-20T10:00:00Z';

export class CreateBookingDto {
  @ApiProperty({ example: '7b1f6c1e-3d0a-4a53-9a5e-2f4f3f1f0c11' })
  @IsUUID('4')
  roomId!: string;

  @ApiProperty({ example: 'Sprint planning' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @NotContains('\0')
  title!: string;

  @ApiProperty({
    description: 'Start time, ISO 8601 with timezone',
    example: '2026-10-20T10:00:00Z',
  })
  @IsISO8601({ strict: true })
  @Matches(ISO_WITH_TIMEZONE, {
    message: `startsAt ${ISO_WITH_TIMEZONE_MESSAGE}`,
  })
  startsAt!: string;

  @ApiProperty({
    description: 'End time, ISO 8601 with timezone',
    example: '2026-10-20T11:00:00Z',
  })
  @IsISO8601({ strict: true })
  @Matches(ISO_WITH_TIMEZONE, {
    message: `endsAt ${ISO_WITH_TIMEZONE_MESSAGE}`,
  })
  endsAt!: string;

  @ApiProperty({ example: 6, minimum: 1, maximum: MAX_ROOM_CAPACITY })
  @IsInt()
  @Min(1)
  @Max(MAX_ROOM_CAPACITY)
  attendeesCount!: number;
}
