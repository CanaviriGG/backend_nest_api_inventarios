import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { ClienteproveedorService } from './clienteproveedor.service.js';
import { CreateClienteproveedorDto } from './dto/create-clienteproveedor.dto.js';
import { UpdateClienteproveedorDto } from './dto/update-clienteproveedor.dto.js';

@Controller('clienteproveedor')
export class ClienteproveedorController {
  constructor(
    private readonly clienteproveedorService: ClienteproveedorService,
  ) {}

  @Post()
  create(@Body() createClienteproveedorDto: CreateClienteproveedorDto) {
    return this.clienteproveedorService.create(createClienteproveedorDto);
  }

  @Get()
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.clienteproveedorService.findAll(page, limit, search);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clienteproveedorService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClienteproveedorDto: UpdateClienteproveedorDto,
  ) {
    return this.clienteproveedorService.update(id, updateClienteproveedorDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clienteproveedorService.remove(id);
  }
}
