import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { Clienteproveedor } from '../clienteproveedor/entities/clienteproveedor.entity.js';
import { Almacen } from '../inventarios/almacen/entities/almacen.entity.js';
import { AlmacenProducto } from '../inventarios/almacen/entities/almacen_producto.entity.js';
import { Producto } from '../inventarios/producto/entities/producto.entity.js';
import { User } from '../users/entities/user.entity.js';
import { NotaService } from './nota.service.js';
import { Movimiento } from './entities/movimiento.entity.js';
import { Nota } from './entities/nota.entity.js';

describe('NotaService', () => {
  let service: NotaService;
  let notaRepository: any;
  let queryBuilder: any;
  let repos: any;
  let queryRunner: any;
  let dataSource: any;

  const nota = {
    id: 1,
    tipo_nota: 'compra',
    estado_nota: 'pendiente',
    observaciones: '',
    clienteproveedor: { id: 1, razon_social: 'Proveedor Prueba' },
    user: { id: '11', name: 'ana1255' },
    movimientos: [],
  };

  const dto = {
    tipo_nota: 'compra' as const,
    clienteproveedor_id: 1,
    user_id: 11,
    movimientos: [
      {
        producto_id: 10,
        almacen_id: 1,
        cantidad: 5,
        tipo_movimiento: 'ingreso' as const,
      },
    ],
  };

  beforeEach(async () => {
    queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[nota], 1]),
      getOne: vi.fn().mockResolvedValue({ ...nota }),
    };

    notaRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
      merge: vi
        .fn()
        .mockImplementation((target, source) => Object.assign(target, source)),
      save: vi.fn().mockImplementation(async (entity) => entity),
    };

    repos = {
      Clienteproveedor: {
        findOneBy: vi.fn().mockResolvedValue({ id: 1 }),
      },
      User: {
        findOneBy: vi.fn().mockResolvedValue({ id: '11' }),
      },
      Nota: {
        create: vi.fn().mockImplementation((data) => ({ ...data })),
        save: vi.fn().mockImplementation(async (entity) => {
          if (!entity.id) entity.id = 1;
          return entity;
        }),
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
      },
      AlmacenProducto: {
        findOne: vi.fn().mockResolvedValue({ id: 5, cantidad_actual: 10 }),
        create: vi.fn().mockImplementation((data) => ({ ...data })),
        save: vi.fn().mockImplementation(async (entity) => entity),
      },
    };

    const manager = {
      getRepository: vi.fn().mockImplementation((entity: any) => repos[entity.name]),
      findOne: vi.fn().mockResolvedValue({
        ...nota,
        movimientos: [
          {
            id: 100,
            cantidad: 5,
            tipo_movimiento: 'ingreso',
            almacen: { id: 1 },
            producto: { id: 10 },
          },
        ],
      }),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
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
      getRepository: vi.fn().mockImplementation((entity: any) => repos[entity.name]),
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
      const result = await service.create(dto);

      expect(repos.Clienteproveedor.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(repos.User.findOneBy).toHaveBeenCalledWith({ id: '11' });
      expect(repos.Nota.create).toHaveBeenCalledWith(
        expect.objectContaining({ estado_nota: 'pendiente', observaciones: '' }),
      );
      expect(repos.AlmacenProducto.save).toHaveBeenCalledWith(
        expect.objectContaining({ cantidad_actual: 15 }),
      );
      expect(repos.Movimiento.save).toHaveBeenCalledWith(
        expect.objectContaining({ precio_compra: 0, precio_venta: 0 }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(result.movimientos).toHaveLength(1);
    });

    it('crea el registro de stock si no existía', async () => {
      repos.AlmacenProducto.findOne.mockResolvedValue(null);

      await service.create(dto);

      expect(repos.AlmacenProducto.save).toHaveBeenCalledWith(
        expect.objectContaining({ cantidad_actual: 5 }),
      );
    });

    it('rechaza una salida sin stock y revierte la transacción', async () => {
      repos.AlmacenProducto.findOne.mockResolvedValue(null);
      const salidaSinStock = {
        ...dto,
        movimientos: [{ ...dto.movimientos[0], tipo_movimiento: 'salida' as const }],
      };

      await expect(service.create(salidaSinStock)).rejects.toThrow(
        BadRequestException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el cliente/proveedor no existe', async () => {
      repos.Clienteproveedor.findOneBy.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      repos.User.findOneBy.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow('Usuario no encontrado');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
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
      expect(result).toEqual({
        data: [nota],
        total: 1,
        limit: 5,
        page: 2,
        totalPages: 1,
        search: 'Proveedor',
      });
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
      expect(result).toEqual(nota);
    });

    it('lanza NotFoundException si no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(9999)).rejects.toThrow('Nota no encontrada');
    });
  });

  describe('update', () => {
    it('mezcla los cambios y guarda', async () => {
      const result = await service.update(1, { estado_nota: 'anulado' });

      expect(notaRepository.merge).toHaveBeenCalled();
      expect(notaRepository.save).toHaveBeenCalled();
      expect(result.estado_nota).toBe('anulado');
    });

    it('rechaza modificar movimientos', async () => {
      await expect(
        service.update(1, { movimientos: dto.movimientos }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.update(9999, { estado_nota: 'anulado' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('revierte el stock, elimina movimientos y nota', async () => {
      await service.remove(1);

      expect(repos.AlmacenProducto.save).toHaveBeenCalledWith(
        expect.objectContaining({ cantidad_actual: 5 }),
      );
      expect(queryRunner.manager.delete).toHaveBeenCalledWith(Movimiento, [100]);
      expect(queryRunner.manager.delete).toHaveBeenCalledWith(Nota, { id: 1 });
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('lanza NotFoundException si no existe', async () => {
      queryRunner.manager.findOne.mockResolvedValue(null);

      await expect(service.remove(9999)).rejects.toThrow(NotFoundException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
