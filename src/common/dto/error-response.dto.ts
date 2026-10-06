import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/rooms' })
  path!: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Room id: "7b1f6c1e-3d0a-4a53-9a5e-2f4f3f1f0c11" not found',
  })
  message!: string | string[];
}
