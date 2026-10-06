import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  NotContains,
} from 'class-validator';
import { Trim } from '../../common/transforms/trim.transform.js';

export class CreateEquipmentDto {
  @ApiProperty({
    description: 'Equipment name',
    example: 'projector',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @NotContains('\0')
  name!: string;
}
