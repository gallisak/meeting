import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEquipmentDto } from './dto/create-equipment.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class EquipmentService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll() {
        return this.prisma.equipment.findMany({
            orderBy: { name: "asc" }
        });
    }

    async create(dto: CreateEquipmentDto) {
        try {
            return await this.prisma.equipment.create({
                data: {
                    name: dto.name
                }
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException(`Equipment named "${dto.name}" already exists`);
            }
            throw error;
        }
    }
}
