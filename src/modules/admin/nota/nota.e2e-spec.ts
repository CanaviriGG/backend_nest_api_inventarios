import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { vi } from 'vitest';
import { NotaController } from './nota.controller.js';
import { NotaService } from './nota.service.js';
import { Nota } from './entities/nota.entity.js';

describe('NotaController (HTTP)', () => {
  let app: INestApplication;
  let notaRepository: any;
  let dataSource: any;
  let repos: any;
  let queryRunner: any;
  let queryBuilder: any;
  let entidadDevuelta: any;

  const dtoValido = {
    tipo_nota: 'compra',
    clienteproveedor_id: 1,
    user_id: 11,
    movimientos: [
      {
        producto_id: 10,
        almacen_id: 1,
        cantidad: 5,
        tipo_movimiento: 'ingreso',
      },
    ],
  };

  beforeEach(async () => {
    entidadDevuelta = {
      id: 1,
      ...dtoValido,
      estado_nota: 'pendiente',
      user: { id: '11', name: 'ana1255', password: 'hash-no-debe-devolverse' },
    };

    queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockImplementation(async () => [[entidadDevuelta], 1]),
      getOne: vi.fn().mockImplementation(async () => entidadDevuelta),
    };

    notaRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
      merge: vi
        .fn()
        .mockImplementation((target, source) => Object.assign(target, source)),
      save: vi.fn().mockImplementation(async (entity) => entity),
    };

    repos = {
      Clienteproveedor: { findOneBy: vi.fn().mockResolvedValue({ id: 1 }) },
      User: { findOneBy: vi.fn().mockResolvedValue({ id: '11' }) },
      Nota: {
        create: vi.fn().mockImplementation((data) => ({ ...data })),
        save: vi.fn().mockImplementation(async (entity) => {
          if (!entity.id) entity.id = 1;
          entidadDevuelta = entity;
          return entity;
        }),
      },
      Producto: { findOneBy: vi.fn().mockResolvedValue({ id: 10 }) },
      Almacen: { findOneBy: vi.fn().mockResolvedValue({ id: 1 }) },
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

    queryRunner = {
      manager: {
        getRepository: vi.fn().mockImplementation((entity: any) => repos[entity.name]),
        findOne: vi.fn().mockImplementation(async () => ({
          ...entidadDevuelta,
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
        delete: vi.fn().mockResolvedValue({ affected: 1 }),
      },
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

    const moduleRef = await Test.createTestingModule({
      controllers: [NotaController],
      providers: [
        NotaService,
        { provide: getRepositoryToken(Nota), useValue: notaRepository },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /nota crea la nota y actualiza el stock', async () => {
    const response = await request(app.getHttpServer())
      .post('/nota')
      .send(dtoValido)
      .expect(201);

    expect(response.body).toMatchObject({
      id: 1,
      tipo_nota: 'compra',
      estado_nota: 'pendiente',
    });
    expect(repos.AlmacenProducto.save).toHaveBeenCalledWith(
      expect.objectContaining({ cantidad_actual: 15 }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('POST /nota rechaza tipo y movimientos inválidos', async () => {
    const response = await request(app.getHttpServer())
      .post('/nota')
      .send({
        tipo_nota: 'otro',
        clienteproveedor_id: 1,
        user_id: 11,
        movimientos: [{ producto_id: 10, almacen_id: 1, cantidad: 0, tipo_movimiento: 'x' }],
      })
      .expect(400);

    expect(response.body.message).toBeDefined();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('POST /nota rechaza campos no declarados', async () => {
    await request(app.getHttpServer())
      .post('/nota')
      .send({ ...dtoValido, campoInexistente: 1 })
      .expect(400);
  });

  it('GET /nota devuelve la estructura paginada', async () => {
    const response = await request(app.getHttpServer())
      .get('/nota')
      .query({ page: 2, limit: 5, search: 'compra' })
      .expect(200);

    expect(response.body).toMatchObject({
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
      search: 'compra',
    });
    expect(response.body.data[0].user.password).toBeUndefined();
    expect(queryBuilder.andWhere).toHaveBeenCalled();
  });

  it('GET /nota/:id devuelve la nota', async () => {
    const response = await request(app.getHttpServer())
      .get('/nota/1')
      .expect(200);

    expect(response.body).toMatchObject({ id: 1, tipo_nota: 'compra' });
    expect(response.body.user.password).toBeUndefined();
  });

  it('GET /nota/:id devuelve 404 si no existe', async () => {
    entidadDevuelta = null;

    const response = await request(app.getHttpServer())
      .get('/nota/9999')
      .expect(404);

    expect(response.body.message).toBe('Nota no encontrada');
  });

  it('PATCH /nota/:id actualiza el estado', async () => {
    const response = await request(app.getHttpServer())
      .patch('/nota/1')
      .send({ estado_nota: 'anulado' })
      .expect(200);

    expect(response.body.estado_nota).toBe('anulado');
  });

  it('PATCH /nota/:id rechaza modificar movimientos', async () => {
    await request(app.getHttpServer())
      .patch('/nota/1')
      .send({ movimientos: dtoValido.movimientos })
      .expect(400);
  });

  it('DELETE /nota/:id revierte el stock y elimina la nota', async () => {
    const response = await request(app.getHttpServer())
      .delete('/nota/1')
      .expect(200);

    expect(repos.AlmacenProducto.save).toHaveBeenCalledWith(
      expect.objectContaining({ cantidad_actual: 5 }),
    );
    expect(response.body.user.password).toBeUndefined();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('DELETE /nota/:id devuelve 404 si no existe', async () => {
    queryRunner.manager.findOne.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .delete('/nota/9999')
      .expect(404);

    expect(response.body.message).toBe('Nota no encontrada');
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});
