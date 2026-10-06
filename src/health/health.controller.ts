import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Server functionality check' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The service is running stably',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-10-05T12:00:00.000Z',
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
