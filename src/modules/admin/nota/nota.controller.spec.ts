import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { NotaController } from './nota.controller.js';
import { NotaService } from './nota.service.js';

describe('NotaController', () => {
  let controller: NotaController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      findAll: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({ id: 1, estado_nota: 'anulado' }),
      remove: vi.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotaController],
      providers: [{ provide: NotaService, useValue: service }],
    }).compile();

    controller = module.get<NotaController>(NotaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delega create al servicio', async () => {
    const dto = {
      tipo_nota: 'compra' as const,
      clienteproveedor_id: 1,
      user_id: 11,
      movimientos: [],
    };

    await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delega findAll con paginación y búsqueda', async () => {
    await controller.findAll(2, 5, 'compra');

    expect(service.findAll).toHaveBeenCalledWith(2, 5, 'compra');
  });

  it('delega findOne, update y remove', async () => {
    await controller.findOne(1);
    await controller.update(1, { estado_nota: 'anulado' });
    await controller.remove(1);

    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(service.update).toHaveBeenCalledWith(1, { estado_nota: 'anulado' });
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
