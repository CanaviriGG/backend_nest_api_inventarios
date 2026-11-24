import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Nota } from '../nota/dto/nota.entity.js';
import { ClienteproveedorService } from './clienteproveedor.service.js';
import { ClienteproveedorController } from './clienteproveedor.controller.js';
import { Clienteproveedor } from './entities/clienteproveedor.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Clienteproveedor, Nota])],
  controllers: [ClienteproveedorController],
  providers: [ClienteproveedorService],
})
export class ClienteproveedorModule {}
