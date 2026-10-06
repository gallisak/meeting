import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Room name',
    example: 'Large room',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    description: 'Room capacity',
    example: 20,
  })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiProperty({
    description: 'Room floor',
    example: 4,
  })
  @IsInt()
  @Min(1)
  floor!: number;

  @ApiPropertyOptional({
    description: 'Room active status',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Array of equipment UUIDs',
    example: ['a93052b9-1cdc-43fa-b33b-04f607362ac8'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  equipmentIds?: string[];
}
