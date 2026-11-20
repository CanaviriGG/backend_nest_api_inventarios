import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sucursal } from '../sucursal/entities/sucursal.entity.js';
import { Almacen } from './entities/almacen.entity.js';
import { AlmacenService } from './almacen.service.js';
import { AlmacenController } from './almacen.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Almacen, Sucursal])],
  controllers: [AlmacenController],
  providers: [AlmacenService],
})
export class AlmacenModule {}
