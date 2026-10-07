import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import type { SafeUser } from '../users/users.service.js';
import { BookingsService } from './bookings.service.js';
import {
  BookingResponseDto,
  PaginatedBookingsResponseDto,
} from './dto/booking-response.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { QueryBookingsDto } from './dto/query-bookings.dto.js';
import { UpdateBookingDto } from './dto/update-booking.dto.js';

@ApiTags('Bookings')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Unauthorized',
  type: ErrorResponseDto,
})
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a booking' })
  @ApiCreatedResponse({
    description: 'Booking successfully created',
    type: BookingResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or a booking rule is violated',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Room not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Room is not active or the slot is already booked',
    type: ErrorResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Server is busy, the request can be repeated',
    type: ErrorResponseDto,
  })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get paginated list of bookings (members see only their own)',
  })
  @ApiOkResponse({
    description: 'Paginated list of bookings',
    type: PaginatedBookingsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  findAll(@CurrentUser() user: SafeUser, @Query() query: QueryBookingsDto) {
    return this.bookingsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking by ID (owner or admin)' })
  @ApiOkResponse({
    description: 'Booking details',
    type: BookingResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Booking ID is not a valid UUID',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: not the booking owner',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Booking not found',
    type: ErrorResponseDto,
  })
  findOne(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change booking title or time (owner or admin)' })
  @ApiOkResponse({
    description: 'Booking successfully updated',
    type: BookingResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or a booking rule is violated',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: not the booking owner',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Booking not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Booking is cancelled, room is not active or the slot is already booked',
    type: ErrorResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Server is busy, the request can be repeated',
    type: ErrorResponseDto,
  })
  update(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(user, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a booking (owner or admin)' })
  @ApiOkResponse({
    description: 'Booking cancelled',
    type: BookingResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Booking ID is not a valid UUID',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: not the booking owner',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Booking not found',
    type: ErrorResponseDto,
  })
  cancel(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.cancel(user, id);
  }
}
