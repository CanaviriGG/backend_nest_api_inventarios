import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { ClienteproveedorController } from './clienteproveedor.controller.js';
import { ClienteproveedorService } from './clienteproveedor.service.js';

describe('ClienteproveedorController', () => {
  let controller: ClienteproveedorController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      findAll: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({ id: 1, estado: false }),
      remove: vi.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClienteproveedorController],
      providers: [{ provide: ClienteproveedorService, useValue: service }],
    }).compile();

    controller = module.get<ClienteproveedorController>(
      ClienteproveedorController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delega create al servicio', async () => {
    const dto = { tipo: 'cliente' as const, razon_social: 'Juan Pérez' };

    await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delega findAll con paginación y búsqueda', async () => {
    await controller.findAll(2, 5, 'Juan');

    expect(service.findAll).toHaveBeenCalledWith(2, 5, 'Juan');
  });

  it('delega findOne, update y remove con el id', async () => {
    await controller.findOne(1);
    await controller.update(1, { estado: false });
    await controller.remove(1);

    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(service.update).toHaveBeenCalledWith(1, { estado: false });
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
