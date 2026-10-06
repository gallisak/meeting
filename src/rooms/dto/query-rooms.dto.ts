import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { MAX_ROOM_CAPACITY, MAX_ROOM_FLOOR } from './create-room.dto.js';

export class QueryRoomsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Minimum room capacity' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ROOM_CAPACITY)
  @IsOptional()
  minCapacity?: number;

  @ApiPropertyOptional({ description: 'Floor' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ROOM_FLOOR)
  @IsOptional()
  floor?: number;

  @ApiPropertyOptional({ description: 'Filter by equipment ID' })
  @IsUUID('4')
  @IsOptional()
  equipmentId?: string;

  @ApiPropertyOptional({ description: 'Room activity status' })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
