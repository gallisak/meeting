import { Module } from '@nestjs/common';
import { EquipmentController } from './equipment.controller.js';
import { EquipmentService } from './equipment.service.js';

@Module({
  controllers: [EquipmentController],
  providers: [EquipmentService],
})
export class EquipmentModule {}
