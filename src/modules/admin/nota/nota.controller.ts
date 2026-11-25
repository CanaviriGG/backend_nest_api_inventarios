import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard } from '../../auth/auth.guard.js';
import { NotaService } from './nota.service.js';
import { CreateNotaDto } from './dto/create-nota.dto.js';
import { UpdateNotaDto } from './dto/update-nota.dto.js';

interface SesionUsuario {
  sub?: string | number;
}

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('nota')
export class NotaController {
  constructor(private readonly notaService: NotaService) {}

  @Post()
  create(
    @Body() createNotaDto: CreateNotaDto,
    @Request() req: { user?: SesionUsuario },
  ) {
    return this.notaService.create(createNotaDto, req.user ?? {});
  }

  @Get()
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'tipo_nota',
    required: false,
    enum: ['compra', 'venta', 'devolucion'],
  })
  @ApiQuery({ name: 'estado_nota', required: false, type: String })
  @ApiQuery({ name: 'clienteproveedor_id', required: false, type: Number })
  @ApiQuery({
    name: 'fecha_inicio',
    required: false,
    type: String,
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'fecha_fin',
    required: false,
    type: String,
    example: '2026-12-31',
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query('search') search?: string,
    @Query('tipo_nota') tipo_nota?: string,
    @Query('estado_nota') estado_nota?: string,
    @Query('clienteproveedor_id') clienteproveedor_id?: string,
    @Query('fecha_inicio') fecha_inicio?: string,
    @Query('fecha_fin') fecha_fin?: string,
  ) {
    return this.notaService.findAll(
      page,
      limit,
      search,
      tipo_nota,
      estado_nota,
      clienteproveedor_id ? Number(clienteproveedor_id) : undefined,
      fecha_inicio,
      fecha_fin,
    );
  }

  @Get(':id/generar-recibo-pdf')
  funOneReportePDF(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    return this.notaService.funGenerarReportePDFPorID(id, res);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.notaService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateNotaDto: UpdateNotaDto,
  ) {
    return this.notaService.update(id, updateNotaDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.notaService.remove(id);
  }
}
