import { ApiProperty } from '@nestjs/swagger';

export class EquipmentResponseDto {
  @ApiProperty({ example: 'a93052b9-1cdc-43fa-b33b-04f607362ac8' })
  id!: string;

  @ApiProperty({ example: 'projector' })
  name!: string;

  @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
  updatedAt!: Date;
}

export class PaginatedEquipmentResponseDto {
  @ApiProperty({ type: [EquipmentResponseDto] })
  items!: EquipmentResponseDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;
}
