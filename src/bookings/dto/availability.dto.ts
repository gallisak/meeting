import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, Matches } from 'class-validator';

export class AvailabilityQueryDto {
  @ApiProperty({ description: 'Day in UTC, YYYY-MM-DD', example: '2026-10-20' })
  @IsISO8601({ strict: true })
  @Matches(/^20\d{2}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;
}

export class FreeSlotDto {
  @ApiProperty({ example: '2026-10-20T00:00:00.000Z' })
  startsAt!: Date;

  @ApiProperty({ example: '2026-10-20T10:00:00.000Z' })
  endsAt!: Date;
}

export class AvailabilityResponseDto {
  @ApiProperty({ example: '7b1f6c1e-3d0a-4a53-9a5e-2f4f3f1f0c11' })
  roomId!: string;

  @ApiProperty({ example: '2026-10-20' })
  date!: string;

  @ApiProperty({ type: [FreeSlotDto] })
  slots!: FreeSlotDto[];
}
