import { ApiProperty } from '@nestjs/swagger';
import { EquipmentResponseDto } from '../../equipment/dto/equipment-response.dto.js';

export class RoomResponseDto {
  @ApiProperty({ example: '7b1f6c1e-3d0a-4a53-9a5e-2f4f3f1f0c11' })
  id!: string;

  @ApiProperty({ example: 'Large room' })
  name!: string;

  @ApiProperty({ example: 20 })
  capacity!: number;

  @ApiProperty({ example: 4 })
  floor!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: [EquipmentResponseDto] })
  equipments!: EquipmentResponseDto[];
}

export class PaginatedRoomsResponseDto {
  @ApiProperty({ type: [RoomResponseDto] })
  items!: RoomResponseDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;
}
