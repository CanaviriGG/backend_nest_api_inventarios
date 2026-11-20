import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { Sucursal } from '../sucursal/entities/sucursal.entity.js';
import { AlmacenService } from './almacen.service.js';
import { Almacen } from './entities/almacen.entity.js';

describe('AlmacenService', () => {
  let service: AlmacenService;
  let almacenRepository: any;
  let sucursalRepository: any;
  let queryBuilder: any;

  const sucursal = { id: 1, nombre: 'Sucursal Centro', ciudad: 'Lima' };

  const almacen = {
    id: 1,
    nombre: 'Almacén Central',
    codigo: 'ALM-001',
    descripcion: 'Almacén principal',
    sucursal,
    productos: [],
  };

  const dto = {
    nombre: 'Almacén Central',
    codigo: 'ALM-001',
    descripcion: 'Almacén principal',
    sucursalId: 1,
  };

  beforeEach(async () => {
    queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[almacen], 1]),
      getOne: vi.fn().mockResolvedValue({ ...almacen }),
    };

    almacenRepository = {
      create: vi.fn().mockImplementation((data) => ({ ...data })),
      save: vi.fn().mockImplementation(async (entity) => ({ id: 1, ...entity })),
      merge: vi
        .fn()
        .mockImplementation((target, source) => Object.assign(target, source)),
      remove: vi.fn().mockImplementation(async (entity) => entity),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };

    sucursalRepository = {
      findOne: vi.fn().mockResolvedValue(sucursal),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlmacenService,
        { provide: getRepositoryToken(Almacen), useValue: almacenRepository },
        { provide: getRepositoryToken(Sucursal), useValue: sucursalRepository },
      ],
    }).compile();

    service = module.get<AlmacenService>(AlmacenService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('resuelve la sucursal y guarda el almacén', async () => {
      const result = await service.create(dto);

      expect(sucursalRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(almacenRepository.create).toHaveBeenCalledWith({
        ...dto,
        sucursal,
      });
      expect(almacenRepository.save).toHaveBeenCalled();
      expect(result).toMatchObject(dto);
    });

    it('lanza NotFoundException si la sucursal no existe', async () => {
      sucursalRepository.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      await expect(service.create(dto)).rejects.toThrow(
        'Sucursal no encontrada',
      );
    });
  });

  describe('findAll', () => {
    it('devuelve la estructura paginada con valores por defecto', async () => {
      const result = await service.findAll();

      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [almacen],
        total: 1,
        limit: 10,
        page: 1,
        totalPages: 1,
        search: undefined,
        sucursal: undefined,
      });
    });

    it('aplica paginación, búsqueda y filtro por sucursal', async () => {
      await service.findAll(2, 5, 'Central', 3);

      expect(queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(almacen.nombre ILIKE :search OR almacen.codigo ILIKE :search)',
        { search: '%Central%' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'sucursal.id = :sucursal',
        { sucursal: 3 },
      );
    });
  });

  describe('findOne', () => {
    it('busca por id cargando sucursal y productos', async () => {
      const result = await service.findOne(1);

      expect(queryBuilder.where).toHaveBeenCalledWith('almacen.id = :id', {
        id: 1,
      });
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'almacen.sucursal',
        'sucursal',
      );
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'almacen.productos',
        'almacenProducto',
      );
      expect(result).toMatchObject({ id: 1, nombre: 'Almacén Central' });
    });

    it('lanza NotFoundException si no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(99)).rejects.toThrow(
        'Almacén no encontrado',
      );
    });
  });

  describe('update', () => {
    it('mezcla los cambios y guarda', async () => {
      const result = await service.update(1, { nombre: 'Almacén Norte' });

      expect(almacenRepository.merge).toHaveBeenCalled();
      expect(almacenRepository.save).toHaveBeenCalled();
      expect(result.nombre).toBe('Almacén Norte');
    });

    it('cambia la sucursal cuando se envía sucursalId', async () => {
      const nuevaSucursal = { id: 2, nombre: 'Sucursal Norte' };
      sucursalRepository.findOne.mockResolvedValue(nuevaSucursal);

      const result = await service.update(1, { sucursalId: 2 });

      expect(result.sucursal).toEqual(nuevaSucursal);
    });

    it('lanza NotFoundException si la nueva sucursal no existe', async () => {
      sucursalRepository.findOne.mockResolvedValue(null);

      await expect(service.update(1, { sucursalId: 2 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('elimina el almacén si no tiene productos', async () => {
      await service.remove(1);

      expect(almacenRepository.remove).toHaveBeenCalled();
    });

    it('rechaza eliminar si tiene productos asociados', async () => {
      queryBuilder.getOne.mockResolvedValue({
        ...almacen,
        productos: [{ id: 10, cantidad_actual: 5 }],
      });

      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
      await expect(service.remove(1)).rejects.toThrow(
        'No se puede eliminar el almacén porque tiene productos asociados',
      );
      expect(almacenRepository.remove).not.toHaveBeenCalled();
    });
  });
});
