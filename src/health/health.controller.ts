import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthResponseDto } from './dto/health-response.dto.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Server and database functionality check' })
  @ApiOkResponse({
    description: 'The service is running and the database is reachable',
    type: HealthResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'The database is unavailable',
    type: ErrorResponseDto,
  })
  async check(): Promise<HealthResponseDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
