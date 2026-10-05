import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryRoomsDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of records (max 100)', default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Minimum room capacity' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  minCapacity?: number;

  @ApiPropertyOptional({ description: 'Floor' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  floor?: number;

  @ApiPropertyOptional({ description: 'Filter by equipment ID' })
  @IsUUID('4')
  @IsOptional()
  equipmentId?: string;

  @ApiPropertyOptional({ description: 'Room activity status' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}