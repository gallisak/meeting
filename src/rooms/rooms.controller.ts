import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { QueryRoomsDto } from './dto/query-rooms.dto.js';
import {
  PaginatedRoomsResponseDto,
  RoomResponseDto,
} from './dto/room-response.dto.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';
import { RoomsService } from './rooms.service.js';

@ApiTags('Rooms')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Unauthorized',
  type: ErrorResponseDto,
})
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new meeting room (Admin only)' })
  @ApiCreatedResponse({
    description: 'Room successfully created',
    type: RoomResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: Admin role required',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'One or more equipment IDs not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Room with this name already exists',
    type: ErrorResponseDto,
  })
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of rooms with filters' })
  @ApiOkResponse({
    description: 'Paginated list of rooms',
    type: PaginatedRoomsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  findAll(@Query() query: QueryRoomsDto) {
    return this.roomsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room details by ID' })
  @ApiOkResponse({
    description: 'Room details with equipment',
    type: RoomResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Room ID is not a valid UUID',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Room not found',
    type: ErrorResponseDto,
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Update room details or deactivate room (Admin only)',
  })
  @ApiOkResponse({
    description: 'Room successfully updated',
    type: RoomResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: Admin role required',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Room or equipment not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Room with this name already exists',
    type: ErrorResponseDto,
  })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.update(id, dto);
  }
}
