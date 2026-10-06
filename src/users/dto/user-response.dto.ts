import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ example: 'c56a4180-65aa-42ec-a945-5fd21dec0538' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Andrii' })
  name!: string;

  @ApiProperty({ enum: Role, example: Role.MEMBER })
  role!: Role;

  @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
  updatedAt!: Date;
}
