import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { vi } from 'vitest';
import { Sucursal } from '../sucursal/entities/sucursal.entity.js';
import { AlmacenModule } from './almacen.module.js';
import { Almacen } from './entities/almacen.entity.js';

describe('AlmacenController (HTTP)', () => {
  let app: INestApplication;
  let almacenRepository: any;
  let sucursalRepository: any;
  let queryBuilder: any;
  let entidadDevuelta: any;

  const store = new Map<number, any>();
  let siguienteId = 1;

  const sucursal = { id: 1, nombre: 'Sucursal Centro', ciudad: 'Lima' };

  const dtoValido = {
    nombre: 'Almacén Central',
    codigo: 'ALM-001',
    descripcion: 'Almacén principal',
    sucursalId: 1,
  };

  beforeEach(async () => {
    store.clear();
    siguienteId = 1;
    entidadDevuelta = { id: 1, ...dtoValido, sucursal, productos: [] };

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

    almacenRepository = {
      create: vi.fn().mockImplementation((data) => ({ ...data, productos: [] })),
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

    sucursalRepository = {
      findOne: vi.fn().mockResolvedValue(sucursal),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AlmacenModule],
    })
      .overrideProvider(getRepositoryToken(Almacen))
      .useValue(almacenRepository)
      .overrideProvider(getRepositoryToken(Sucursal))
      .useValue(sucursalRepository)
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

  it('POST /almacen crea un almacén válido', async () => {
    const response = await request(app.getHttpServer())
      .post('/almacen')
      .send(dtoValido)
      .expect(201);

    expect(response.body).toMatchObject(dtoValido);
    expect(response.body.sucursal).toEqual(sucursal);
    expect(almacenRepository.save).toHaveBeenCalled();
  });

  it('POST /almacen rechaza un DTO vacío con 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/almacen')
      .send({})
      .expect(400);

    expect(response.body.message).toBeDefined();
    expect(almacenRepository.save).not.toHaveBeenCalled();
  });

  it('POST /almacen rechaza campos no declarados', async () => {
    await request(app.getHttpServer())
      .post('/almacen')
      .send({ ...dtoValido, campoInexistente: 1 })
      .expect(400);
  });

  it('POST /almacen devuelve 404 si la sucursal no existe', async () => {
    sucursalRepository.findOne.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/almacen')
      .send(dtoValido)
      .expect(404);

    expect(response.body.message).toBe('Sucursal no encontrada');
  });

  it('GET /almacen devuelve la estructura paginada', async () => {
    store.set(1, entidadDevuelta);

    const response = await request(app.getHttpServer())
      .get('/almacen')
      .query({ page: 1, limit: 3, search: 'Central', sucursal: 1 })
      .expect(200);

    expect(response.body).toMatchObject({
      total: 1,
      page: 1,
      limit: 3,
      totalPages: 1,
      search: 'Central',
      sucursal: 1,
    });
    expect(response.body.data).toHaveLength(1);
    expect(queryBuilder.andWhere).toHaveBeenCalled();
  });

  it('GET /almacen/:id devuelve el almacén', async () => {
    const response = await request(app.getHttpServer())
      .get('/almacen/1')
      .expect(200);

    expect(response.body).toMatchObject({
      id: 1,
      nombre: 'Almacén Central',
    });
    expect(queryBuilder.where).toHaveBeenCalledWith('almacen.id = :id', {
      id: 1,
    });
  });

  it('GET /almacen/:id devuelve 404 si no existe', async () => {
    entidadDevuelta = null;

    const response = await request(app.getHttpServer())
      .get('/almacen/99')
      .expect(404);

    expect(response.body.message).toBe('Almacén no encontrado');
  });

  it('PATCH /almacen/:id actualiza parcialmente', async () => {
    const response = await request(app.getHttpServer())
      .patch('/almacen/1')
      .send({ nombre: 'Almacén Norte' })
      .expect(200);

    expect(response.body.nombre).toBe('Almacén Norte');
    expect(response.body.codigo).toBe('ALM-001');
    expect(almacenRepository.save).toHaveBeenCalled();
  });

  it('DELETE /almacen/:id elimina el almacén', async () => {
    await request(app.getHttpServer()).delete('/almacen/1').expect(200);

    expect(almacenRepository.remove).toHaveBeenCalled();
    expect(store.size).toBe(0);
  });
});
