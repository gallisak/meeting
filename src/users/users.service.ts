import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export const USER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
};

export type UserWithPassword = SafeUser & { passwordHash: string };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdSafe(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_SAFE_SELECT,
    });
  }

  async findByEmailWithPassword(
    email: string,
  ): Promise<UserWithPassword | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { ...USER_SAFE_SELECT, passwordHash: true },
    });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: Role;
  }): Promise<SafeUser> {
    return this.prisma.user.create({
      data,
      select: USER_SAFE_SELECT,
    });
  }

  async updateRefreshTokenHash(
    userId: string,
    refreshTokenHash: string | null,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  async rotateRefreshToken(
    userId: string,
    currentHash: string,
    newHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: {
        id: userId,
        refreshTokenHash: currentHash,
      },
      data: {
        refreshTokenHash: newHash,
      },
    });
    return result.count > 0;
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.findByIdSafe(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
