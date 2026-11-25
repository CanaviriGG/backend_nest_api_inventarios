import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { vi } from 'vitest';
import { AuthGuard } from '../../auth/auth.guard.js';
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
      remove: vi.fn().mockResolvedValue({ message: 'La nota fue eliminada' }),
      funGenerarReportePDFPorID: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotaController],
      providers: [{ provide: NotaService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotaController>(NotaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delega create al servicio con el usuario de la sesión', async () => {
    const dto = {
      tipo_nota: 'compra' as const,
      clienteproveedor_id: 1,
      movimientos: [],
    };
    const req = { user: { sub: 11 } };

    await controller.create(dto, req);

    expect(service.create).toHaveBeenCalledWith(dto, { sub: 11 });
  });

  it('delega findAll con paginación, filtros y búsqueda', async () => {
    await controller.findAll(
      2,
      5,
      'mercadería',
      'compra',
      'aprobada',
      '1',
      '2026-01-01',
      '2026-12-31',
    );

    expect(service.findAll).toHaveBeenCalledWith(
      2,
      5,
      'mercadería',
      'compra',
      'aprobada',
      1,
      '2026-01-01',
      '2026-12-31',
    );
  });

  it('delega findOne, update y remove', async () => {
    await controller.findOne(1);
    await controller.update(1, { estado_nota: 'anulado' });
    await controller.remove(1);

    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(service.update).toHaveBeenCalledWith(1, { estado_nota: 'anulado' });
    expect(service.remove).toHaveBeenCalledWith(1);
  });

  it('delega la generación del PDF', () => {
    const res = { setHeader: vi.fn() } as unknown as Response;

    controller.funOneReportePDF(1, res);

    expect(service.funGenerarReportePDFPorID).toHaveBeenCalledWith(1, res);
  });
});
