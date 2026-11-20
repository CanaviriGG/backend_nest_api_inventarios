import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AlmacenController } from './almacen.controller.js';
import { AlmacenService } from './almacen.service.js';

describe('AlmacenController', () => {
  let controller: AlmacenController;

  const serviceMock = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const dto = {
    nombre: 'Almacén Central',
    codigo: 'ALM-001',
    descripcion: 'Almacén principal',
    sucursalId: 1,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlmacenController],
      providers: [{ provide: AlmacenService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AlmacenController>(AlmacenController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('create delega al service', () => {
    controller.create(dto);

    expect(serviceMock.create).toHaveBeenCalledWith(dto);
  });

  it('findAll pasa paginación, búsqueda y sucursal al service', () => {
    controller.findAll(2, 5, 3, 'Central');

    expect(serviceMock.findAll).toHaveBeenCalledWith(2, 5, 'Central', 3);
  });

  it('findAll usa valores por defecto', () => {
    controller.findAll();

    expect(serviceMock.findAll).toHaveBeenCalledWith(1, 10, undefined, 0);
  });

  it('findOne convierte el id a número', () => {
    controller.findOne('7');

    expect(serviceMock.findOne).toHaveBeenCalledWith(7);
  });

  it('update convierte el id y pasa el DTO', () => {
    controller.update('3', { nombre: 'Almacén Norte' });

    expect(serviceMock.update).toHaveBeenCalledWith(3, {
      nombre: 'Almacén Norte',
    });
  });

  it('remove convierte el id a número', () => {
    controller.remove('4');

    expect(serviceMock.remove).toHaveBeenCalledWith(4);
  });
});
