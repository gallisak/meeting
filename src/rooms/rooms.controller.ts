import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateRoomDto } from './dto/create-room-dto.dto.js';
import { QueryRoomsDto } from './dto/query-rooms-dto.dto.js';
import { UpdateRoomDto } from './dto/update-room-dto.dto.js';
import { RoomsService } from './rooms.service.js';

@ApiTags('Rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new meeting room' })
  @ApiResponse({ status: 201, description: 'Room successfully created' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Room with this name already exists' })
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of rooms with filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of rooms' })
  findAll(@Query() query: QueryRoomsDto) {
    return this.roomsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room details by ID' })
  @ApiResponse({ status: 200, description: 'Room details with equipment' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update room details or deactivate room' })
  @ApiResponse({ status: 200, description: 'Room successfully updated' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 409, description: 'Room with this name already exists' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.update(id, dto);
  }
}