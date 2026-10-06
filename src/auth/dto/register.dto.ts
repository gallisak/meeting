import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'SecretPassword123!',
    description: 'User password (min 6 chars)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Andrii', description: 'User display name' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
