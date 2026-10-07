import { PartialType, PickType } from '@nestjs/swagger';
import { CreateBookingDto } from './create-booking.dto.js';

export class UpdateBookingDto extends PartialType(
  PickType(CreateBookingDto, ['title', 'startsAt', 'endsAt'] as const),
  { skipNullProperties: false },
) {}
