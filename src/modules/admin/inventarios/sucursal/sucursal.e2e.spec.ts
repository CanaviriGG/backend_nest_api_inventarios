import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { vi } from 'vitest';
import { Sucursal } from './entities/sucursal.entity.js';
import { SucursalModule } from './sucursal.module.js';

describe('SucursalController (HTTP)', () => {
  let app: INestApplication;
  let repository: any;
  let queryBuilder: any;
  let entidadDevuelta: any;

  const store = new Map<number, any>();
  let siguienteId = 1;

  const dtoValido = {
    nombre: 'Sucursal Centro',
    direccion: 'Av. Lima 123, Cercado de Lima',
    telefono: '+51 987654321',
    ciudad: 'Lima',
  };

  beforeEach(async () => {
    store.clear();
    siguienteId = 1;
    entidadDevuelta = { id: 1, ...dtoValido, almacenes: [] };

    queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi
        .fn()
        .mockImplementation(async () => [[...store.values()], store.size]),
      getOne: vi.fn().mockImplementation(async () => entidadDevuelta),
    };

    repository = {
      create: vi.fn().mockImplementation((data) => ({ ...data, almacenes: [] })),
      save: vi.fn().mockImplementation(async (entity) => {
        if (!entity.id) entity.id = siguienteId++;
        store.set(entity.id, entity);
        entidadDevuelta = entity;
        return entity;
      }),
      merge: vi
        .fn()
        .mockImplementation((target, source) => Object.assign(target, source)),
      remove: vi.fn().mockImplementation(async (entity) => {
        store.delete(entity.id);
        return entity;
      }),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [SucursalModule],
    })
      .overrideProvider(getRepositoryToken(Sucursal))
      .useValue(repository)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /sucursal crea una sucursal válida', async () => {
    const response = await request(app.getHttpServer())
      .post('/sucursal')
      .send(dtoValido)
      .expect(201);

    expect(response.body).toMatchObject(dtoValido);
    expect(response.body.id).toBe(1);
    expect(repository.save).toHaveBeenCalled();
  });

  it('POST /sucursal rechaza un DTO vacío con 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/sucursal')
      .send({})
      .expect(400);

    expect(response.body.message).toBeDefined();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('POST /sucursal rechaza campos no declarados', async () => {
    await request(app.getHttpServer())
      .post('/sucursal')
      .send({ ...dtoValido, campoInexistente: 1 })
      .expect(400);
  });

  it('GET /sucursal devuelve la estructura paginada', async () => {
    store.set(1, { id: 1, ...dtoValido, almacenes: [] });

    const response = await request(app.getHttpServer())
      .get('/sucursal')
      .query({ page: 1, limit: 3, search: 'Lima' })
      .expect(200);

    expect(response.body).toMatchObject({
      total: 1,
      page: 1,
      limit: 3,
      totalPages: 1,
      search: 'Lima',
    });
    expect(response.body.data).toHaveLength(1);
    expect(queryBuilder.andWhere).toHaveBeenCalled();
  });

  it('GET /sucursal/:id devuelve la sucursal', async () => {
    const response = await request(app.getHttpServer())
      .get('/sucursal/1')
      .expect(200);

    expect(response.body).toMatchObject({ id: 1, nombre: 'Sucursal Centro' });
    expect(queryBuilder.where).toHaveBeenCalledWith('sucursal.id = :id', {
      id: 1,
    });
  });

  it('GET /sucursal/:id devuelve 404 si no existe', async () => {
    entidadDevuelta = null;

    const response = await request(app.getHttpServer())
      .get('/sucursal/99')
      .expect(404);

    expect(response.body.message).toBe('Sucursal no encontrada');
  });

  it('PATCH /sucursal/:id actualiza parcialmente', async () => {
    const response = await request(app.getHttpServer())
      .patch('/sucursal/1')
      .send({ ciudad: 'Arequipa' })
      .expect(200);

    expect(response.body.ciudad).toBe('Arequipa');
    expect(response.body.nombre).toBe('Sucursal Centro');
    expect(repository.save).toHaveBeenCalled();
  });

  it('DELETE /sucursal/:id elimina la sucursal', async () => {
    await request(app.getHttpServer()).delete('/sucursal/1').expect(200);

    expect(repository.remove).toHaveBeenCalled();
    expect(store.size).toBe(0);
  });
});
