import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { Nota } from '../nota/entities/nota.entity.js';
import { ClienteproveedorService } from './clienteproveedor.service.js';
import { Clienteproveedor } from './entities/clienteproveedor.entity.js';

describe('ClienteproveedorService', () => {
  let service: ClienteproveedorService;
  let repository: any;
  let notaRepository: any;
  let queryBuilder: any;

  const clienteproveedor = {
    id: 1,
    tipo: 'cliente' as const,
    razon_social: 'Juan Pérez',
    identificacion: '1234567',
    direccion: 'Av. Siempre Viva 742',
    telefono: '77712345',
    correo: 'juan@mail.com',
    estado: true,
  };

  const dto = {
    tipo: 'cliente' as const,
    razon_social: 'Juan Pérez',
    correo: 'juan@mail.com',
  };

  beforeEach(async () => {
    queryBuilder = {
      andWhere: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[clienteproveedor], 1]),
      getOne: vi.fn().mockResolvedValue({ ...clienteproveedor }),
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

    notaRepository = {
      count: vi.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClienteproveedorService,
        { provide: getRepositoryToken(Clienteproveedor), useValue: repository },
        { provide: getRepositoryToken(Nota), useValue: notaRepository },
      ],
    }).compile();

    service = module.get<ClienteproveedorService>(ClienteproveedorService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea y guarda con estado activo por defecto', async () => {
      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith({ ...dto, estado: true });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 1, estado: true });
    });

    it('respeta el estado enviado', async () => {
      await service.create({ ...dto, estado: false });

      expect(repository.create).toHaveBeenCalledWith({
        ...dto,
        estado: false,
      });
    });
  });

  describe('findAll', () => {
    it('devuelve la estructura paginada con valores por defecto', async () => {
      const result = await service.findAll();

      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [clienteproveedor],
        total: 1,
        limit: 10,
        page: 1,
        totalPages: 1,
        search: undefined,
      });
    });

    it('aplica paginación y búsqueda', async () => {
      await service.findAll(2, 5, 'Juan');

      expect(queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('clienteproveedor.razon_social ILIKE :search'),
        { search: '%Juan%' },
      );
    });
  });

  describe('findOne', () => {
    it('busca por id', async () => {
      const result = await service.findOne(1);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'clienteproveedor.id = :id',
        { id: 1 },
      );
      expect(result).toEqual(clienteproveedor);
    });

    it('lanza NotFoundException si no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(9999)).rejects.toThrow(
        'Cliente o proveedor no encontrado',
      );
    });
  });

  describe('update', () => {
    it('mezcla los cambios y guarda', async () => {
      const result = await service.update(1, { razon_social: 'Juan Actualizado' });

      expect(repository.merge).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result.razon_social).toBe('Juan Actualizado');
    });

    it('lanza NotFoundException si no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.update(9999, { estado: false })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('elimina si no tiene notas asociadas', async () => {
      await service.remove(1);

      expect(notaRepository.count).toHaveBeenCalledWith({
        where: { clienteproveedor: { id: 1 } },
      });
      expect(repository.remove).toHaveBeenCalled();
    });

    it('lanza ConflictException si tiene notas asociadas', async () => {
      notaRepository.count.mockResolvedValue(2);

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
      await expect(service.remove(1)).rejects.toThrow(
        'No se puede eliminar el cliente o proveedor porque tiene notas asociadas',
      );
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
