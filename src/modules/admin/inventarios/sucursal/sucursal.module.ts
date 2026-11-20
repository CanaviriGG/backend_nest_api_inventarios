import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sucursal } from './entities/sucursal.entity.js';
import { SucursalService } from './sucursal.service.js';
import { SucursalController } from './sucursal.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Sucursal])],
  controllers: [SucursalController],
  providers: [SucursalService],
})
export class SucursalModule {}
