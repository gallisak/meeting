import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { BookingsService } from './bookings.service.js';
import {
  AvailabilityQueryDto,
  AvailabilityResponseDto,
} from './dto/availability.dto.js';

@ApiTags('Rooms')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Unauthorized',
  type: ErrorResponseDto,
})
@Controller('rooms')
export class AvailabilityController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get(':id/availability')
  @ApiOperation({ summary: 'Get free slots of a room for a UTC day' })
  @ApiOkResponse({
    description: 'Free slots of the room',
    type: AvailabilityResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Room not found',
    type: ErrorResponseDto,
  })
  getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.bookingsService.getAvailability(id, query.date);
  }
}
