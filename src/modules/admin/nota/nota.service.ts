import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Clienteproveedor } from '../clienteproveedor/entities/clienteproveedor.entity.js';
import { Almacen } from '../inventarios/almacen/entities/almacen.entity.js';
import { AlmacenProducto } from '../inventarios/almacen/entities/almacen_producto.entity.js';
import { Producto } from '../inventarios/producto/entities/producto.entity.js';
import { Movimiento } from './entities/movimiento.entity.js';
import { Nota } from './entities/nota.entity.js';
import { CreateNotaDto } from './dto/create-nota.dto.js';
import { UpdateNotaDto } from './dto/update-nota.dto.js';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';

type TipoMovimiento = 'ingreso' | 'salida' | 'devolucion';

@Injectable()
export class NotaService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Nota)
    private readonly notaRepository: Repository<Nota>,
  ) {}

  async create(
    createNotaDto: CreateNotaDto,
    user_sesion: { sub?: string | number },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (!user_sesion?.sub) {
        throw new UnauthorizedException('Usuario no autenticado');
      }

      const userRepository = queryRunner.manager.getRepository(User);
      const clienteProveedorRepository = queryRunner.manager.getRepository(
        Clienteproveedor,
      );
      const notaRepository = queryRunner.manager.getRepository(Nota);
      const productoRepository = queryRunner.manager.getRepository(Producto);
      const almacenRepository = queryRunner.manager.getRepository(Almacen);
      const movimientoRepository = queryRunner.manager.getRepository(Movimiento);

      const clienteproveedor = await clienteProveedorRepository.findOneBy({
        id: createNotaDto.clienteproveedor_id,
      });
      if (!clienteproveedor) {
        throw new NotFoundException('Cliente/Proveedor no encontrado');
      }

      const user = await userRepository.findOneBy({
        id: String(user_sesion.sub),
      });
      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const nota = notaRepository.create({
        tipo_nota: createNotaDto.tipo_nota,
        fecha: new Date(),
        estado_nota: 'pendiente',
        observaciones: createNotaDto.observaciones ?? '',
        clienteproveedor,
        user,
      });
      await notaRepository.save(nota);

      const movimientosGuardados: Movimiento[] = [];

      for (const movimientoDto of createNotaDto.movimientos ?? []) {
        const producto = await productoRepository.findOneBy({
          id: movimientoDto.producto_id,
        });
        if (!producto) throw new NotFoundException('Producto no encontrado');

        const almacen = await almacenRepository.findOneBy({
          id: movimientoDto.almacen_id,
        });
        if (!almacen) throw new NotFoundException('Almacén no encontrado');

        await this.actualizarStockQueryRunner(
          queryRunner,
          almacen,
          producto,
          movimientoDto.cantidad,
          movimientoDto.tipo_movimiento,
        );

        const movimiento = movimientoRepository.create({
          cantidad: movimientoDto.cantidad,
          tipo_movimiento: movimientoDto.tipo_movimiento,
          precio_compra: movimientoDto.precio_compra ?? 0,
          precio_venta: movimientoDto.precio_venta ?? 0,
          observaciones: movimientoDto.observaciones ?? '',
          nota,
          producto,
          almacen,
        });
        const movimientoGuardado = await movimientoRepository.save(movimiento);
        movimientosGuardados.push(movimientoGuardado);
      }

      nota.movimientos = movimientosGuardados;
      await queryRunner.commitTransaction();
      return this.sanitizarNota(nota);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    tipo_nota?: string,
    estado_nota?: string,
    clienteproveedor_id?: number,
    fecha_inicio?: string,
    fecha_fin?: string,
  ) {
    const pagina = Math.max(1, Number(page) || 0);
    const limite = Math.max(1, Number(limit) || 0);

    const queryBuilder = this.construirQueryBuilder().orderBy(
      'nota.id',
      'DESC',
    );

    if (search) {
      queryBuilder.andWhere(
        '(nota.observaciones ILIKE :search OR clienteproveedor.razon_social ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (tipo_nota) {
      queryBuilder.andWhere('nota.tipo_nota = :tipo_nota', { tipo_nota });
    }

    if (estado_nota) {
      queryBuilder.andWhere('nota.estado_nota = :estado_nota', { estado_nota });
    }

    if (clienteproveedor_id) {
      queryBuilder.andWhere('clienteproveedor.id = :clienteproveedor_id', {
        clienteproveedor_id,
      });
    }

    if (fecha_inicio && fecha_fin) {
      queryBuilder.andWhere('nota.fecha BETWEEN :fecha_inicio AND :fecha_fin', {
        fecha_inicio: new Date(`${fecha_inicio}T00:00:00`),
        fecha_fin: new Date(`${fecha_fin}T23:59:59`),
      });
    } else if (fecha_inicio) {
      queryBuilder.andWhere('nota.fecha >= :fecha_inicio', {
        fecha_inicio: new Date(`${fecha_inicio}T00:00:00`),
      });
    } else if (fecha_fin) {
      queryBuilder.andWhere('nota.fecha <= :fecha_fin', {
        fecha_fin: new Date(`${fecha_fin}T23:59:59`),
      });
    }

    queryBuilder.skip((pagina - 1) * limite).take(limite);

    const [notas, total] = await queryBuilder.getManyAndCount();

    return {
      data: notas.map((nota) => this.sanitizarNota(nota)),
      total,
      limit: limite,
      page: pagina,
      totalPages: Math.ceil(total / limite),
      search,
      tipo_nota,
      estado_nota,
      clienteproveedor_id,
      fecha_inicio,
      fecha_fin,
    };
  }

  async findOne(id: number) {
    const nota = await this.construirQueryBuilder()
      .where('nota.id = :id', { id })
      .getOne();

    if (!nota) throw new NotFoundException('Nota no encontrada');

    return this.sanitizarNota(nota);
  }

  async update(id: number, updateNotaDto: UpdateNotaDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const notaRepository = queryRunner.manager.getRepository(Nota);
      const clienteProveedorRepository = queryRunner.manager.getRepository(
        Clienteproveedor,
      );
      const productoRepository = queryRunner.manager.getRepository(Producto);
      const almacenRepository = queryRunner.manager.getRepository(Almacen);
      const movimientoRepository = queryRunner.manager.getRepository(Movimiento);

      const nota = await notaRepository.findOne({
        where: { id },
        relations: { movimientos: { producto: true, almacen: true } },
      });
      if (!nota) throw new NotFoundException('Nota no encontrada');

      const { movimientos, clienteproveedor_id, ...datos } = updateNotaDto;

      if (clienteproveedor_id !== undefined) {
        const clienteproveedor = await clienteProveedorRepository.findOneBy({
          id: clienteproveedor_id,
        });
        if (!clienteproveedor) {
          throw new NotFoundException('Cliente/Proveedor no encontrado');
        }
        nota.clienteproveedor = clienteproveedor;
      }

      // Si se envían movimientos, se reemplazan y se ajusta el stock
      if (movimientos !== undefined) {
        for (const anterior of nota.movimientos ?? []) {
          await this.revertirStockQueryRunner(
            queryRunner,
            anterior.almacen,
            anterior.producto,
            Number(anterior.cantidad),
            anterior.tipo_movimiento,
          );
        }
        await movimientoRepository.remove(nota.movimientos ?? []);

        const movimientosGuardados: Movimiento[] = [];

        for (const movimientoDto of movimientos) {
          const producto = await productoRepository.findOneBy({
            id: movimientoDto.producto_id,
          });
          if (!producto) throw new NotFoundException('Producto no encontrado');

          const almacen = await almacenRepository.findOneBy({
            id: movimientoDto.almacen_id,
          });
          if (!almacen) throw new NotFoundException('Almacén no encontrado');

          await this.actualizarStockQueryRunner(
            queryRunner,
            almacen,
            producto,
            movimientoDto.cantidad,
            movimientoDto.tipo_movimiento,
          );

          const movimiento = movimientoRepository.create({
            cantidad: movimientoDto.cantidad,
            tipo_movimiento: movimientoDto.tipo_movimiento,
            precio_compra: movimientoDto.precio_compra ?? 0,
            precio_venta: movimientoDto.precio_venta ?? 0,
            observaciones: movimientoDto.observaciones ?? '',
            nota,
            producto,
            almacen,
          });
          movimientosGuardados.push(await movimientoRepository.save(movimiento));
        }

        nota.movimientos = movimientosGuardados;
      }

      notaRepository.merge(nota, datos);
      await notaRepository.save(nota);

      await queryRunner.commitTransaction();
      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const notaRepository = queryRunner.manager.getRepository(Nota);
      const movimientoRepository = queryRunner.manager.getRepository(Movimiento);

      const nota = await notaRepository.findOne({
        where: { id },
        relations: { movimientos: { producto: true, almacen: true } },
      });
      if (!nota) throw new NotFoundException('Nota no encontrada');

      // Revertir el stock de los movimientos antes de eliminar
      for (const movimiento of nota.movimientos ?? []) {
        await this.revertirStockQueryRunner(
          queryRunner,
          movimiento.almacen,
          movimiento.producto,
          Number(movimiento.cantidad),
          movimiento.tipo_movimiento,
        );
      }

      await movimientoRepository.remove(nota.movimientos ?? []);
      await notaRepository.remove(nota);

      await queryRunner.commitTransaction();
      return { message: 'La nota fue eliminada' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async actualizarStockQueryRunner(
    queryRunner: QueryRunner,
    almacen: Almacen,
    producto: Producto,
    cantidad: number,
    tipoMovimiento: TipoMovimiento,
  ) {
    const almacenProductoRepository =
      queryRunner.manager.getRepository(AlmacenProducto);

    const almacenProducto = await almacenProductoRepository.findOne({
      where: {
        almacen: { id: almacen.id },
        producto: { id: producto.id },
      },
    });

    if (!almacenProducto) {
      if (tipoMovimiento === 'salida') {
        throw new BadRequestException(
          'No hay stock registrado para este producto en este almacén',
        );
      }
      const nuevoAlmacenProducto = almacenProductoRepository.create({
        almacen,
        producto,
        cantidad_actual: Number(cantidad),
        fecha_actualizacion: new Date(),
      });
      await almacenProductoRepository.save(nuevoAlmacenProducto);
      return;
    }

    const stockActual = Number(almacenProducto.cantidad_actual);

    if (tipoMovimiento === 'ingreso' || tipoMovimiento === 'devolucion') {
      almacenProducto.cantidad_actual = stockActual + Number(cantidad);
    } else {
      if (stockActual < Number(cantidad)) {
        throw new BadRequestException('Stock insuficiente para la salida');
      }
      almacenProducto.cantidad_actual = stockActual - Number(cantidad);
    }
    almacenProducto.fecha_actualizacion = new Date();

    await almacenProductoRepository.save(almacenProducto);
  }

  private async revertirStockQueryRunner(
    queryRunner: QueryRunner,
    almacen: Almacen,
    producto: Producto,
    cantidad: number,
    tipoMovimiento: TipoMovimiento,
  ) {
    const almacenProductoRepository =
      queryRunner.manager.getRepository(AlmacenProducto);

    const almacenProducto = await almacenProductoRepository.findOne({
      where: {
        almacen: { id: almacen.id },
        producto: { id: producto.id },
      },
    });

    if (!almacenProducto) return;

    const stockActual = Number(almacenProducto.cantidad_actual);
    const cantidadRevertida = Number(cantidad);

    if (tipoMovimiento === 'ingreso' || tipoMovimiento === 'devolucion') {
      almacenProducto.cantidad_actual = Math.max(
        0,
        stockActual - cantidadRevertida,
      );
    } else {
      almacenProducto.cantidad_actual = stockActual + cantidadRevertida;
    }
    almacenProducto.fecha_actualizacion = new Date();

    await almacenProductoRepository.save(almacenProducto);
  }

  private sanitizarNota<T extends Nota>(nota: T) {
    if (!nota.user) return nota;
    const { password: _password, ...usuario } = nota.user;
    return { ...nota, user: usuario as User };
  }

  private construirQueryBuilder() {
    return this.notaRepository
      .createQueryBuilder('nota')
      .leftJoinAndSelect('nota.clienteproveedor', 'clienteproveedor')
      .leftJoinAndSelect('nota.user', 'user')
      .leftJoinAndSelect('nota.movimientos', 'movimiento')
      .leftJoinAndSelect('movimiento.producto', 'producto')
      .leftJoinAndSelect('movimiento.almacen', 'almacen')
      .select([
        'nota',
        'clienteproveedor',
        'user.id',
        'user.name',
        'user.email',
        'user.status',
        'movimiento',
        'producto',
        'almacen',
      ]);
  }

  async funGenerarReportePDFPorID(id: number, res: Response) {
    const nota = await this.notaRepository
      .createQueryBuilder('nota')
      .leftJoinAndSelect('nota.user', 'user')
      .leftJoinAndSelect('nota.clienteproveedor', 'clienteproveedor')
      .leftJoinAndSelect('nota.movimientos', 'movimientos')
      .leftJoinAndSelect('movimientos.producto', 'producto')
      .where('nota.id = :id', { id })
      .getOne();

    if (!nota) {
      throw new NotFoundException('La nota no existe');
    }

    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 40,
        bottom: 40,
        left: 40,
        right: 40,
      },
      bufferPages: true,
      info: {
        Title: `Comprobante de ${nota.tipo_nota} N° ${nota.id}`,
        Author: 'Sistema de inventario',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=comprobante_${nota.id}.pdf`,
    );

    doc.pipe(res);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    const blue = '#0B5394';
    const gray = '#F2F4F7';
    const textColor = '#333333';

    const moneda = (valor: number | string) =>
      new Intl.NumberFormat('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(valor) || 0);

    const fecha = new Date(nota.fecha).toLocaleString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const tituloPorTipo: Record<
      'compra' | 'venta' | 'devolucion',
      string
    > = {
      compra: 'COMPROBANTE DE COMPRA',
      venta: 'COMPROBANTE DE VENTA',
      devolucion: 'COMPROBANTE DE DEVOLUCIÓN',
    };

    const movimientos = nota.movimientos ?? [];

    const items = movimientos.map((movimiento) => {
      const precioUnitario =
        nota.tipo_nota === 'compra'
          ? Number(movimiento.precio_compra)
          : Number(movimiento.precio_venta);

      const cantidad = Number(movimiento.cantidad) || 0;

      return {
        nombre: movimiento.producto?.nombre ?? 'Producto sin nombre',
        unidad: movimiento.producto?.unidad_medida ?? '',
        cantidad,
        precioUnitario: Number.isFinite(precioUnitario) ? precioUnitario : 0,
        subtotal:
          cantidad * (Number.isFinite(precioUnitario) ? precioUnitario : 0),
      };
    });

    const total = items.reduce((suma, item) => suma + item.subtotal, 0);

    const dibujarEncabezado = () => {
      doc
        .font('Helvetica-Bold')
        .fontSize(22)
        .fillColor(blue)
        .text('COMPROBANTE', margin, 40, {
          width: contentWidth,
          align: 'center',
        });

      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(textColor)
        .text(tituloPorTipo[nota.tipo_nota] ?? 'COMPROBANTE', margin, 72, {
          width: contentWidth,
          align: 'center',
        });

      doc
        .moveTo(margin, 98)
        .lineTo(pageWidth - margin, 98)
        .strokeColor(blue)
        .lineWidth(1.5)
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(textColor)
        .text(`N.º de comprobante: ${nota.id}`, margin, 110);

      doc.font('Helvetica').fontSize(10).text(`Fecha: ${fecha}`, margin, 126);

      doc
        .font('Helvetica')
        .text(`Estado: ${nota.estado_nota ?? 'Sin estado'}`, margin, 142);

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(blue)
        .text('DATOS DEL CLIENTE / PROVEEDOR', margin, 170);

      const persona = nota.clienteproveedor;

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(textColor)
        .text(
          `Razón social: ${persona?.razon_social ?? 'No especificado'}`,
          margin,
          190,
          { width: contentWidth },
        );

      doc.text(
        `Identificación: ${persona?.identificacion ?? 'No especificada'}`,
        margin,
        206,
        { width: contentWidth },
      );

      doc.text(
        `Dirección: ${persona?.direccion ?? 'No especificada'}`,
        margin,
        222,
        { width: contentWidth },
      );

      doc.text(
        `Teléfono: ${persona?.telefono ?? 'No especificado'}`,
        margin,
        238,
        { width: contentWidth },
      );

      doc.text(
        `Atendido por: ${nota.user?.name ?? 'No especificado'}`,
        margin,
        254,
        { width: contentWidth },
      );
    };

    const columnas = [
      { titulo: 'N.º', ancho: 30, align: 'left' as const },
      { titulo: 'Producto', ancho: 190, align: 'left' as const },
      { titulo: 'Cant.', ancho: 55, align: 'right' as const },
      { titulo: 'P. unitario', ancho: 100, align: 'right' as const },
      { titulo: 'Subtotal', ancho: 90, align: 'right' as const },
    ];

    const tableWidth = columnas.reduce(
      (suma, columna) => suma + columna.ancho,
      0,
    );

    const dibujarCabeceraTabla = (y: number) => {
      doc.rect(margin, y, tableWidth, 25).fill(blue);

      let x = margin;

      columnas.forEach((columna) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#FFFFFF')
          .text(columna.titulo, x + 4, y + 8, {
            width: columna.ancho - 8,
            align: columna.align,
          });

        x += columna.ancho;
      });

      return y + 25;
    };

    dibujarEncabezado();

    let y = dibujarCabeceraTabla(285);

    items.forEach((item, index) => {
      const nombre = item.unidad
        ? `${item.nombre} (${item.unidad})`
        : item.nombre;

      const alturaNombre = doc
        .font('Helvetica')
        .fontSize(9)
        .heightOfString(nombre, {
          width: columnas[1].ancho - 8,
        });

      const rowHeight = Math.max(25, alturaNombre + 12);

      if (y + rowHeight > pageHeight - 100) {
        doc.addPage();
        y = dibujarCabeceraTabla(45);
      }

      if (index % 2 === 0) {
        doc.rect(margin, y, tableWidth, rowHeight).fill(gray);
      }

      let x = margin;

      const valores = [
        String(index + 1),
        nombre,
        moneda(item.cantidad),
        moneda(item.precioUnitario),
        moneda(item.subtotal),
      ];

      doc.fillColor(textColor);

      columnas.forEach((columna, i) => {
        doc.font('Helvetica').fontSize(9).text(valores[i], x + 4, y + 6, {
          width: columna.ancho - 8,
          align: columna.align,
          height: rowHeight - 8,
        });

        x += columna.ancho;
      });

      doc
        .moveTo(margin, y + rowHeight)
        .lineTo(margin + tableWidth, y + rowHeight)
        .strokeColor('#D9DEE5')
        .lineWidth(0.5)
        .stroke();

      y += rowHeight;
    });

    if (y + 65 > pageHeight - 40) {
      doc.addPage();
      y = 45;
    }

    y += 15;

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(blue)
      .text('TOTAL GENERAL:', margin, y, {
        width: tableWidth - 110,
        align: 'right',
      });

    doc.text(`Bs ${moneda(total)}`, margin + tableWidth - 105, y, {
      width: 105,
      align: 'right',
    });

    y += 35;

    const observaciones = nota.observaciones?.trim();

    if (observaciones) {
      if (y + 65 > pageHeight - 40) {
        doc.addPage();
        y = 45;
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(blue)
        .text('OBSERVACIONES', margin, y);

      y += 16;

      doc.font('Helvetica').fontSize(9).fillColor(textColor).text(observaciones, margin, y, {
        width: contentWidth,
      });

      y = doc.y + 25;
    }

    if (y + 65 > pageHeight - 40) {
      doc.addPage();
      y = 45;
    }

    y += 30;

    const firmaWidth = 180;
    const firmaDerecha = pageWidth - margin - firmaWidth;

    doc
      .moveTo(margin, y + 25)
      .lineTo(margin + firmaWidth, y + 25)
      .strokeColor('#777777')
      .stroke();

    doc
      .moveTo(firmaDerecha, y + 25)
      .lineTo(firmaDerecha + firmaWidth, y + 25)
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(textColor)
      .text('Entregado por', margin, y + 31, {
        width: firmaWidth,
        align: 'center',
      });

    doc.text('Recibido por', firmaDerecha, y + 31, {
      width: firmaWidth,
      align: 'center',
    });

    const rangoPaginas = doc.bufferedPageRange();

    for (
      let pagina = rangoPaginas.start;
      pagina < rangoPaginas.start + rangoPaginas.count;
      pagina++
    ) {
      doc.switchToPage(pagina);

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#777777')
        .text(
          `Comprobante N.º ${nota.id} | Página ${pagina + 1} de ${rangoPaginas.count}`,
          margin,
          pageHeight - margin - 12,
          {
            width: contentWidth,
            align: 'center',
            lineBreak: false,
          },
        );
    }

    doc.end();
  }
}
