import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { CreateEquipmentDto } from './dto/create-equipment.dto.js';
import {
  EquipmentResponseDto,
  PaginatedEquipmentResponseDto,
} from './dto/equipment-response.dto.js';
import { EquipmentService } from './equipment.service.js';

@ApiTags('Equipment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({
  description: 'Unauthorized',
  type: ErrorResponseDto,
})
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of equipment' })
  @ApiOkResponse({
    description: 'Paginated list of equipment',
    type: PaginatedEquipmentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  findAll(@Query() query: PaginationQueryDto) {
    return this.equipmentService.findAll(query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create new equipment (Admin only)' })
  @ApiCreatedResponse({
    description: 'Equipment successfully created',
    type: EquipmentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: Admin role required',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Equipment with this name already exists',
    type: ErrorResponseDto,
  })
  create(@Body() dto: CreateEquipmentDto) {
    return this.equipmentService.create(dto);
  }
}
