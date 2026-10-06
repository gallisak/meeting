import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { QueryRoomsDto } from './dto/query-rooms.dto.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoomDto) {
    const { equipmentIds, ...roomData } = dto;

    try {
      return await this.prisma.room.create({
        data: {
          ...roomData,
          ...(equipmentIds && equipmentIds.length > 0
            ? {
                equipments: {
                  connect: equipmentIds.map((id) => ({ id })),
                },
              }
            : {}),
        },
        include: {
          equipments: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `A room named "${dto.name}" already exists`,
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('One or more equipment IDs not found');
        }
      }
      throw error;
    }
  }

  async findAll(query: QueryRoomsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.RoomWhereInput = {};

    if (query.minCapacity !== undefined) {
      where.capacity = { gte: query.minCapacity };
    }

    if (query.floor !== undefined) {
      where.floor = query.floor;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.equipmentId) {
      where.equipments = {
        some: {
          id: query.equipmentId,
        },
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          equipments: true,
        },
      }),
      this.prisma.room.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        equipments: true,
      },
    });

    if (!room) {
      throw new NotFoundException(`Room id: "${id}" not found`);
    }

    return room;
  }

  async update(id: string, dto: UpdateRoomDto) {
    await this.findOne(id);

    const { equipmentIds, ...roomData } = dto;

    try {
      return await this.prisma.room.update({
        where: { id },
        data: {
          ...roomData,
          ...(equipmentIds !== undefined
            ? {
                equipments: {
                  set: equipmentIds.map((equipId) => ({ id: equipId })),
                },
              }
            : {}),
        },
        include: {
          equipments: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `A room named "${dto.name}" already exists`,
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('One or more equipment IDs not found');
        }
      }
      throw error;
    }
  }
}
