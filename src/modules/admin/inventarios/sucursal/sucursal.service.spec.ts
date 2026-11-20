import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { Sucursal } from './entities/sucursal.entity.js';
import { SucursalService } from './sucursal.service.js';

describe('SucursalService', () => {
  let service: SucursalService;
  let repository: any;
  let queryBuilder: any;

  const sucursal = {
    id: 1,
    nombre: 'Sucursal Centro',
    direccion: 'Av. Lima 123, Cercado de Lima',
    telefono: '+51 987654321',
    ciudad: 'Lima',
    almacenes: [],
  };

  const dto = {
    nombre: 'Sucursal Centro',
    direccion: 'Av. Lima 123, Cercado de Lima',
    telefono: '+51 987654321',
    ciudad: 'Lima',
  };

  beforeEach(async () => {
    queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[sucursal], 1]),
      getOne: vi.fn().mockResolvedValue({ ...sucursal }),
    };

    repository = {
      create: vi.fn().mockImplementation((data) => ({ ...data })),
      save: vi.fn().mockImplementation(async (entity) => ({ id: 1, ...entity })),
      merge: vi
        .fn()
        .mockImplementation((target, source) => Object.assign(target, source)),
      remove: vi.fn().mockImplementation(async (entity) => entity),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SucursalService,
        { provide: getRepositoryToken(Sucursal), useValue: repository },
      ],
    }).compile();

    service = module.get<SucursalService>(SucursalService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea y guarda la sucursal', async () => {
      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(repository.save).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 1, ...dto });
    });
  });

  describe('findAll', () => {
    it('devuelve la estructura paginada con valores por defecto', async () => {
      const result = await service.findAll();

      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [sucursal],
        total: 1,
        limit: 10,
        page: 1,
        totalPages: 1,
        search: undefined,
      });
    });

    it('aplica paginación y búsqueda por nombre o ciudad', async () => {
      await service.findAll(2, 5, 'Lima');

      expect(queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(sucursal.nombre ILIKE :search OR sucursal.ciudad ILIKE :search)',
        { search: '%Lima%' },
      );
    });
  });

  describe('findOne', () => {
    it('busca por id con sus almacenes', async () => {
      const result = await service.findOne(1);

      expect(queryBuilder.where).toHaveBeenCalledWith('sucursal.id = :id', {
        id: 1,
      });
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'sucursal.almacenes',
        'almacen',
      );
      expect(result).toEqual(sucursal);
    });

    it('lanza NotFoundException si no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(99)).rejects.toThrow(
        'Sucursal no encontrada',
      );
    });
  });

  describe('update', () => {
    it('mezcla los cambios y guarda', async () => {
      const result = await service.update(1, { ciudad: 'Arequipa' });

      expect(repository.merge).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result.ciudad).toBe('Arequipa');
    });

    it('lanza NotFoundException si la sucursal no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.update(99, { ciudad: 'Arequipa' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('elimina la sucursal si no tiene almacenes', async () => {
      await service.remove(1);

      expect(repository.remove).toHaveBeenCalled();
    });

    it('rechaza eliminar si tiene almacenes asociados', async () => {
      queryBuilder.getOne.mockResolvedValue({
        ...sucursal,
        almacenes: [{ id: 10, nombre: 'Almacén Central' }],
      });

      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
      await expect(service.remove(1)).rejects.toThrow(
        'No se puede eliminar la sucursal porque tiene almacenes asociados',
      );
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
