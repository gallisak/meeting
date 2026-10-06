import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotContains,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/transforms/trim.transform.js';

export const MAX_ROOM_CAPACITY = 1000;
export const MAX_ROOM_FLOOR = 200;

export class CreateRoomDto {
  @ApiProperty({
    description: 'Room name',
    example: 'Large room',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @NotContains('\0')
  name!: string;

  @ApiProperty({
    description: 'Room capacity',
    example: 20,
    minimum: 1,
    maximum: MAX_ROOM_CAPACITY,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_ROOM_CAPACITY)
  capacity!: number;

  @ApiProperty({
    description: 'Room floor',
    example: 4,
    minimum: 1,
    maximum: MAX_ROOM_FLOOR,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_ROOM_FLOOR)
  floor!: number;

  @ApiPropertyOptional({
    description: 'Room active status',
    default: true,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Array of equipment UUIDs',
    example: ['a93052b9-1cdc-43fa-b33b-04f607362ac8'],
    type: [String],
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  equipmentIds?: string[];
}
