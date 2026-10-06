import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { SafeUser, UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const { email } = dto;
    const existingUser = await this.usersService.findByEmailWithPassword(email);
    if (existingUser) {
      throw new ConflictException(`User with email "${email}" already exists`);
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    let newUser: SafeUser;
    try {
      newUser = await this.usersService.create({
        email,
        name: dto.name,
        passwordHash,
        role: Role.MEMBER,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `User with email "${email}" already exists`,
        );
      }
      throw error;
    }

    const tokens = await this.generateTokens({
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    await this.usersService.updateRefreshTokenHash(
      newUser.id,
      this.hashToken(tokens.refreshToken),
    );

    return {
      user: newUser,
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const foundUser = await this.usersService.findByEmailWithPassword(
      dto.email,
    );
    if (!foundUser) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { passwordHash, ...user } = foundUser;

    const isPasswordValid = await bcrypt.compare(dto.password, passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    await this.usersService.updateRefreshTokenHash(
      user.id,
      this.hashToken(tokens.refreshToken),
    );

    return {
      user,
      ...tokens,
    };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const currentHash = this.hashToken(dto.refreshToken);

    const tokens = await this.generateTokens({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    });

    const newHash = this.hashToken(tokens.refreshToken);

    const rotated = await this.usersService.rotateRefreshToken(
      payload.sub,
      currentHash,
      newHash,
    );

    if (!rotated) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshTokenHash(userId, null);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(payload: JwtPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<JwtSignOptions['expiresIn']>(
          'JWT_ACCESS_EXPIRES_IN',
        ),
      }),
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<JwtSignOptions['expiresIn']>(
            'JWT_REFRESH_EXPIRES_IN',
          ),
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
