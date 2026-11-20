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
import { AlmacenService } from './almacen.service.js';
import { CreateAlmacenDto } from './dto/create-almacen.dto.js';
import { UpdateAlmacenDto } from './dto/update-almacen.dto.js';

@Controller('almacen')
export class AlmacenController {
  constructor(private readonly almacenService: AlmacenService) {}

  @Post()
  create(@Body() createAlmacenDto: CreateAlmacenDto) {
    return this.almacenService.create(createAlmacenDto);
  }

  @Get()
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sucursal', required: false, type: Number })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query('sucursal', new DefaultValuePipe(0), ParseIntPipe)
    sucursal: number = 0,
    @Query('search') search?: string,
  ) {
    return this.almacenService.findAll(page, limit, search, sucursal);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.almacenService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAlmacenDto: UpdateAlmacenDto) {
    return this.almacenService.update(+id, updateAlmacenDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.almacenService.remove(+id);
  }
}
