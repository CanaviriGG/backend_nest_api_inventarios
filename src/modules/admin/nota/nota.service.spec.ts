import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Writable } from 'node:stream';
import type { Response } from 'express';
import { vi } from 'vitest';
import { Almacen } from '../inventarios/almacen/entities/almacen.entity.js';
import { Producto } from '../inventarios/producto/entities/producto.entity.js';
import { NotaService } from './nota.service.js';
import { Nota } from './entities/nota.entity.js';

describe('NotaService', () => {
  let service: NotaService;
  let notaRepository: any;
  let queryBuilder: any;
  let repos: any;
  let queryRunner: any;
  let dataSource: any;
  let stockActual: number;

  const crearNota = () => ({
    id: 1,
    tipo_nota: 'compra',
    fecha: new Date('2026-01-01T10:00:00'),
    estado_nota: 'pendiente',
    observaciones: 'Compra de prueba',
    clienteproveedor: { id: 1, razon_social: 'Proveedor Prueba' },
    user: { id: '11', name: 'ana1255', password: 'hash-secreto' },
    movimientos: [] as any[],
  });

  const dto = {
    tipo_nota: 'compra' as const,
    clienteproveedor_id: 1,
    observaciones: 'Compra de prueba',
    movimientos: [
      {
        producto_id: 10,
        almacen_id: 1,
        cantidad: 5,
        tipo_movimiento: 'ingreso' as const,
        precio_compra: 10.5,
        precio_venta: 15.5,
      },
    ],
  };

  const sesion = { sub: 11 };

  beforeEach(async () => {
    stockActual = 10;

    queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[crearNota()], 1]),
      getOne: vi.fn().mockImplementation(async () => crearNota()),
    };

    notaRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
      merge: vi
        .fn()
        .mockImplementation((target, source) => Object.assign(target, source)),
      save: vi.fn().mockImplementation(async (entity) => entity),
      findOne: vi.fn().mockImplementation(async () => ({
        ...crearNota(),
        movimientos: [
          {
            id: 100,
            cantidad: 5,
            tipo_movimiento: 'ingreso',
            almacen: { id: 1 },
            producto: { id: 10 },
          },
        ],
      })),
    };

    repos = {
      Clienteproveedor: {
        findOneBy: vi.fn().mockResolvedValue({ id: 1 }),
      },
      User: {
        findOneBy: vi
          .fn()
          .mockResolvedValue({ id: '11', name: 'ana', password: 'hash' }),
      },
      Nota: {
        create: vi.fn().mockImplementation((data) => ({ ...data })),
        save: vi.fn().mockImplementation(async (entity) => {
          if (!entity.id) entity.id = 1;
          return entity;
        }),
        findOne: vi.fn().mockImplementation(async () => ({
          ...crearNota(),
          movimientos: [
            {
              id: 100,
              cantidad: 5,
              tipo_movimiento: 'ingreso',
              almacen: { id: 1 },
              producto: { id: 10 },
            },
          ],
        })),
        merge: vi
          .fn()
          .mockImplementation((target, source) => Object.assign(target, source)),
        remove: vi.fn().mockImplementation(async (entity) => entity),
      },
      Producto: {
        findOneBy: vi.fn().mockResolvedValue({ id: 10 }),
      },
      Almacen: {
        findOneBy: vi.fn().mockResolvedValue({ id: 1 }),
      },
      Movimiento: {
        create: vi.fn().mockImplementation((data) => ({ ...data })),
        save: vi.fn().mockImplementation(async (entity) => ({ id: 100, ...entity })),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      AlmacenProducto: {
        findOne: vi
          .fn()
          .mockImplementation(async () => ({
            id: 5,
            cantidad_actual: stockActual,
          })),
        create: vi.fn().mockImplementation((data) => ({ ...data })),
        save: vi.fn().mockImplementation(async (entity) => {
          stockActual = Number(entity.cantidad_actual);
          return entity;
        }),
      },
    };

    const manager = {
      getRepository: vi.fn().mockImplementation((entity: any) => repos[entity.name]),
    };

    queryRunner = {
      manager,
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      createQueryRunner: vi.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotaService,
        { provide: getRepositoryToken(Nota), useValue: notaRepository },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<NotaService>(NotaService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea la nota, actualiza el stock y confirma la transacción', async () => {
      const result = await service.create(dto, sesion);

      expect(repos.Clienteproveedor.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(repos.User.findOneBy).toHaveBeenCalledWith({ id: '11' });
      expect(repos.Nota.create).toHaveBeenCalledWith(
        expect.objectContaining({
          estado_nota: 'pendiente',
          observaciones: 'Compra de prueba',
        }),
      );
      expect(repos.Nota.create.mock.calls[0][0]).not.toHaveProperty(
        'movimientos',
      );
      expect(repos.AlmacenProducto.save).toHaveBeenCalledWith(
        expect.objectContaining({ cantidad_actual: 15 }),
      );
      expect(repos.Movimiento.save).toHaveBeenCalledWith(
        expect.objectContaining({ precio_compra: 10.5, precio_venta: 15.5 }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(result.movimientos).toHaveLength(1);
      expect(result.user).not.toHaveProperty('password');
    });

    it('crea el registro de stock si no existía', async () => {
      repos.AlmacenProducto.findOne.mockResolvedValue(null);

      await service.create(dto, sesion);

      expect(repos.AlmacenProducto.save).toHaveBeenCalledWith(
        expect.objectContaining({ cantidad_actual: 5 }),
      );
    });

    it('rechaza una salida sin stock y revierte la transacción', async () => {
      repos.AlmacenProducto.findOne.mockResolvedValue(null);
      const salidaSinStock = {
        ...dto,
        movimientos: [
          { ...dto.movimientos[0], tipo_movimiento: 'salida' as const },
        ],
      };

      await expect(service.create(salidaSinStock, sesion)).rejects.toThrow(
        BadRequestException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('lanza NotFoundException si el cliente/proveedor no existe', async () => {
      repos.Clienteproveedor.findOneBy.mockResolvedValue(null);

      await expect(service.create(dto, sesion)).rejects.toThrow(
        NotFoundException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      repos.User.findOneBy.mockResolvedValue(null);

      await expect(service.create(dto, sesion)).rejects.toThrow(
        'Usuario no encontrado',
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rechaza una nota sin usuario en la sesión', async () => {
      await expect(service.create(dto, {})).rejects.toThrow(
        UnauthorizedException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('devuelve la estructura paginada con búsqueda', async () => {
      const result = await service.findAll(2, 5, 'Proveedor');

      expect(queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('clienteproveedor.razon_social ILIKE :search'),
        { search: '%Proveedor%' },
      );
      expect(result).toMatchObject({
        total: 1,
        limit: 5,
        page: 2,
        totalPages: 1,
        search: 'Proveedor',
      });
      expect(result.data[0].user).not.toHaveProperty('password');
    });

    it('normaliza una página o límite inválido', async () => {
      const result = await service.findAll(0, 0);

      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(1);
      expect(Number.isFinite(result.totalPages)).toBe(true);
    });
  });

  describe('findOne', () => {
    it('busca la nota con sus relaciones', async () => {
      const result = await service.findOne(1);

      expect(queryBuilder.where).toHaveBeenCalledWith('nota.id = :id', {
        id: 1,
      });
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'nota.movimientos',
        'movimiento',
      );
      expect(result.id).toBe(1);
      expect(result.user).not.toHaveProperty('password');
    });

    it('lanza NotFoundException si no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(9999)).rejects.toThrow('Nota no encontrada');
    });
  });

  describe('update', () => {
    it('mezcla los cambios y guarda', async () => {
      const nota = crearNota();
      repos.Nota.findOne.mockResolvedValue(nota);
      queryBuilder.getOne.mockResolvedValue(nota);

      const result = await service.update(1, { estado_nota: 'anulado' });

      expect(repos.Nota.merge).toHaveBeenCalled();
      expect(repos.Nota.save).toHaveBeenCalled();
      expect(result.estado_nota).toBe('anulado');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('reemplaza los movimientos y recalcula el stock', async () => {
      const nota = {
        ...crearNota(),
        movimientos: [
          {
            id: 100,
            cantidad: 5,
            tipo_movimiento: 'ingreso' as const,
            almacen: { id: 1 } as Almacen,
            producto: { id: 10 } as Producto,
          },
        ],
      };
      repos.Nota.findOne.mockResolvedValue(nota);
      queryBuilder.getOne.mockResolvedValue(nota);

      await service.update(1, {
        movimientos: [
          {
            producto_id: 10,
            almacen_id: 1,
            cantidad: 3,
            tipo_movimiento: 'ingreso',
            precio_compra: 240,
            precio_venta: 250.5,
          },
        ],
      });

      // 10 -> 5 al revertir el ingreso anterior -> 8 con el nuevo ingreso
      expect(repos.AlmacenProducto.save).toHaveBeenCalledWith(
        expect.objectContaining({ cantidad_actual: 5 }),
      );
      expect(repos.AlmacenProducto.save).toHaveBeenCalledWith(
        expect.objectContaining({ cantidad_actual: 8 }),
      );
      expect(repos.Movimiento.remove).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('lanza NotFoundException si no existe', async () => {
      repos.Nota.findOne.mockResolvedValue(null);

      await expect(
        service.update(9999, { estado_nota: 'anulado' }),
      ).rejects.toThrow(NotFoundException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('revierte el stock, elimina movimientos y nota', async () => {
      const result = await service.remove(1);

      expect(repos.AlmacenProducto.save).toHaveBeenCalledWith(
        expect.objectContaining({ cantidad_actual: 5 }),
      );
      expect(repos.Movimiento.remove).toHaveBeenCalled();
      expect(repos.Nota.remove).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(result).toEqual({ message: 'La nota fue eliminada' });
    });

    it('lanza NotFoundException si no existe', async () => {
      repos.Nota.findOne.mockResolvedValue(null);

      await expect(service.remove(9999)).rejects.toThrow(NotFoundException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('funGenerarReportePDFPorID', () => {
    const capturarPdf = async (id: number) => {
      const chunks: Buffer[] = [];
      const res = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });
      const setHeader = vi.fn();
      Object.assign(res, { setHeader });

      await new Promise<void>((resolve, reject) => {
        res.on('finish', resolve);
        res.on('error', reject);
        void service.funGenerarReportePDFPorID(id, res as unknown as Response);
      });

      return {
        pdf: Buffer.concat(chunks).toString('latin1'),
        setHeader,
      };
    };

    it('genera un PDF válido con los datos de la nota', async () => {
      queryBuilder.getOne.mockResolvedValue({
        ...crearNota(),
        movimientos: [
          {
            id: 100,
            cantidad: 5,
            tipo_movimiento: 'ingreso',
            precio_compra: 10.5,
            precio_venta: 15.5,
            producto: { id: 10, nombre: 'Arroz', unidad_medida: 'kg' },
          },
        ],
      });

      const { pdf, setHeader } = await capturarPdf(1);

      expect(pdf.startsWith('%PDF-')).toBe(true);
      expect(pdf).toContain('/Type /Page');
      expect(pdf).toContain('/Title');
      expect(pdf).toContain('Sistema de inventario');
      // El pie debe estar dentro del margen: si no, pdfkit agrega una página vacía
      expect(pdf).toContain('/Count 1');
      expect(setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=comprobante_1.pdf',
      );
    });

    it('puede paginar cuando hay muchos movimientos', async () => {
      queryBuilder.getOne.mockResolvedValue({
        ...crearNota(),
        movimientos: Array.from({ length: 40 }, (_, index) => ({
          id: index + 1,
          cantidad: 1,
          tipo_movimiento: 'ingreso',
          precio_compra: 10,
          precio_venta: 12,
          producto: {
            id: index + 1,
            nombre: `Producto ${index + 1}`,
            unidad_medida: 'kg',
          },
        })),
      });

      const { pdf } = await capturarPdf(1);
      const paginas = Number(pdf.match(/\/Count (\d+)/)?.[1] ?? 0);

      expect(pdf.startsWith('%PDF-')).toBe(true);
      expect(paginas).toBeGreaterThan(1);
      expect(pdf).toContain('%%EOF');
    });

    it('lanza NotFoundException si la nota no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.funGenerarReportePDFPorID(
          9999,
          { setHeader: vi.fn() } as unknown as Response,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
