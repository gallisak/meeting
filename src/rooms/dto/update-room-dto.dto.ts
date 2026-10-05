import { PartialType } from '@nestjs/swagger';
import { CreateRoomDto } from './create-room-dto.dto.js';

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}