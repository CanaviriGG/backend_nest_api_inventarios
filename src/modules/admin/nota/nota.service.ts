import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Clienteproveedor } from '../clienteproveedor/entities/clienteproveedor.entity.js';
import { Almacen } from '../inventarios/almacen/entities/almacen.entity.js';
import { AlmacenProducto } from '../inventarios/almacen/entities/almacen_producto.entity.js';
import { Producto } from '../inventarios/producto/entities/producto.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateNotaDto } from './dto/create-nota.dto.js';
import { UpdateNotaDto } from './dto/update-nota.dto.js';
import { Movimiento } from './entities/movimiento.entity.js';
import { Nota } from './entities/nota.entity.js';

type TipoMovimiento = 'ingreso' | 'salida' | 'devolucion';

const MOVIMIENTO_INVERSO: Record<TipoMovimiento, TipoMovimiento> = {
  ingreso: 'salida',
  salida: 'ingreso',
  devolucion: 'salida',
};

@Injectable()
export class NotaService {
  constructor(
    @InjectRepository(Nota)
    private readonly notaRepository: Repository<Nota>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(createNotaDto: CreateNotaDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
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
        id: String(createNotaDto.user_id),
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

      nota.movimientos = movimientosGuardados.map((movimiento) => {
        const { nota: _nota, ...datos } = movimiento;
        return datos as Movimiento;
      });
      await queryRunner.commitTransaction();
      return this.sanitizarNota(nota);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const pagina = Math.max(1, page);
    const limite = Math.max(1, limit);
    const queryBuilder = this.construirQueryBuilder();

    if (search) {
      queryBuilder.andWhere(
        '(nota.tipo_nota ILIKE :search OR nota.estado_nota ILIKE :search OR nota.observaciones ILIKE :search OR clienteproveedor.razon_social ILIKE :search)',
        { search: `%${search}%` },
      );
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
    const nota = await this.findOne(id);
    const { clienteproveedor_id, user_id, movimientos, ...datos } =
      updateNotaDto;

    if (movimientos !== undefined) {
      throw new BadRequestException(
        'No se pueden modificar los movimientos de una nota; elimine y cree una nueva nota',
      );
    }

    if (clienteproveedor_id !== undefined) {
      const clienteproveedor = await this.dataSource
        .getRepository(Clienteproveedor)
        .findOneBy({ id: clienteproveedor_id });
      if (!clienteproveedor) {
        throw new NotFoundException('Cliente/Proveedor no encontrado');
      }
      nota.clienteproveedor = clienteproveedor;
    }

    if (user_id !== undefined) {
      const user = await this.dataSource
        .getRepository(User)
        .findOneBy({ id: String(user_id) });
      if (!user) throw new NotFoundException('Usuario no encontrado');
      nota.user = user;
    }

    this.notaRepository.merge(nota, datos);
    return this.sanitizarNota(await this.notaRepository.save(nota));
  }

  async remove(id: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const nota = await queryRunner.manager.findOne(Nota, {
        where: { id },
        relations: {
          movimientos: { producto: true, almacen: true },
        },
      });
      if (!nota) throw new NotFoundException('Nota no encontrada');

      for (const movimiento of nota.movimientos ?? []) {
        await this.actualizarStockQueryRunner(
          queryRunner,
          movimiento.almacen,
          movimiento.producto,
          Number(movimiento.cantidad),
          MOVIMIENTO_INVERSO[movimiento.tipo_movimiento],
        );
      }

      const movimientosIds = (nota.movimientos ?? []).map((m) => m.id);
      if (movimientosIds.length) {
        await queryRunner.manager.delete(Movimiento, movimientosIds);
      }
      await queryRunner.manager.delete(Nota, { id });

      await queryRunner.commitTransaction();
      return this.sanitizarNota(nota);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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

  private async actualizarStockQueryRunner(
    queryRunner: QueryRunner,
    almacen: Almacen,
    producto: Producto,
    cantidad: number,
    tipoMovimiento: TipoMovimiento,
  ) {
    const almacenProductoRepository = queryRunner.manager.getRepository(
      AlmacenProducto,
    );

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
        cantidad_actual: cantidad,
        fecha_actualizacion: new Date(),
      });
      await almacenProductoRepository.save(nuevoAlmacenProducto);
      return;
    }

    if (tipoMovimiento === 'ingreso' || tipoMovimiento === 'devolucion') {
      almacenProducto.cantidad_actual =
        Number(almacenProducto.cantidad_actual) + cantidad;
    } else {
      if (Number(almacenProducto.cantidad_actual) < cantidad) {
        throw new BadRequestException('Stock insuficiente para la salida');
      }
      almacenProducto.cantidad_actual =
        Number(almacenProducto.cantidad_actual) - cantidad;
    }
    almacenProducto.fecha_actualizacion = new Date();

    await almacenProductoRepository.save(almacenProducto);
  }
}
