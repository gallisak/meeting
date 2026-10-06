import { ConflictException, Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEquipmentDto } from './dto/create-equipment.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.equipment.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.equipment.count(),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async create(dto: CreateEquipmentDto) {
    try {
      return await this.prisma.equipment.create({
        data: {
          name: dto.name,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Equipment named "${dto.name}" already exists`,
        );
      }
      throw error;
    }
  }
}
