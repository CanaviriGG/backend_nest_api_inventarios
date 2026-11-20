import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { SucursalController } from './sucursal.controller.js';
import { SucursalService } from './sucursal.service.js';

describe('SucursalController', () => {
  let controller: SucursalController;

  const serviceMock = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const dto = {
    nombre: 'Sucursal Centro',
    direccion: 'Av. Lima 123, Cercado de Lima',
    telefono: '+51 987654321',
    ciudad: 'Lima',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SucursalController],
      providers: [{ provide: SucursalService, useValue: serviceMock }],
    }).compile();

    controller = module.get<SucursalController>(SucursalController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('create delega al service', () => {
    controller.create(dto);

    expect(serviceMock.create).toHaveBeenCalledWith(dto);
  });

  it('findAll pasa paginación y búsqueda al service', () => {
    controller.findAll(2, 5, 'Lima');

    expect(serviceMock.findAll).toHaveBeenCalledWith(2, 5, 'Lima');
  });

  it('findAll usa valores por defecto', () => {
    controller.findAll();

    expect(serviceMock.findAll).toHaveBeenCalledWith(1, 10, undefined);
  });

  it('findOne convierte el id a número', () => {
    controller.findOne('7');

    expect(serviceMock.findOne).toHaveBeenCalledWith(7);
  });

  it('update convierte el id y pasa el DTO', () => {
    controller.update('3', { ciudad: 'Arequipa' });

    expect(serviceMock.update).toHaveBeenCalledWith(3, {
      ciudad: 'Arequipa',
    });
  });

  it('remove convierte el id a número', () => {
    controller.remove('4');

    expect(serviceMock.remove).toHaveBeenCalledWith(4);
  });
});
