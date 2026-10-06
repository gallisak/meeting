import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  NotContains,
} from 'class-validator';
import { Trim } from '../../common/transforms/trim.transform.js';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'SecretPassword123!',
    description: 'User password (6 to 72 chars)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Andrii', description: 'User display name' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @NotContains('\0')
  name!: string;
}
