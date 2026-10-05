import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EquipmentService } from './equipment.service.js';
import { CreateEquipmentDto } from './dto/create-equipment.dto.js';

@ApiTags('Equipment')
@Controller('equipment')
export class EquipmentController {
    constructor(private readonly equipmentService: EquipmentService) {}

    @Get()
    @ApiOperation({ summary: 'Retrieving the list of all equipment' })
    @ApiResponse({ status: 200, description: 'Equipment list' })
    findAll() {
        return this.equipmentService.findAll();
    }

    @Post()
    @ApiOperation({ summary: 'Creation of new equipment' })
    @ApiResponse({ status: 201, description: 'The equipment has been successfully created' })
    @ApiResponse({ status: 400, description: 'Input data validation error' })
    @ApiResponse({ status: 409, description: 'Equipment with this name already exists' })
    create(@Body() dto: CreateEquipmentDto) {
        return this.equipmentService.create(dto);
    }

}
