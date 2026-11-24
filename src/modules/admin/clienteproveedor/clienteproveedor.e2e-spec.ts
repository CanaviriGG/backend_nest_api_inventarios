import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { vi } from 'vitest';
import { Nota } from '../nota/dto/nota.entity.js';
import { ClienteproveedorModule } from './clienteproveedor.module.js';
import { Clienteproveedor } from './entities/clienteproveedor.entity.js';

describe('ClienteproveedorController (HTTP)', () => {
  let app: INestApplication;
  let repository: any;
  let notaRepository: any;
  let queryBuilder: any;
  let entidadDevuelta: any;
  let notasAsociadas = 0;

  const store = new Map<number, any>();
  let siguienteId = 1;

  const dtoValido = {
    tipo: 'cliente',
    razon_social: 'Juan Pérez',
    identificacion: '1234567',
    correo: 'juan@mail.com',
  };

  beforeEach(async () => {
    store.clear();
    siguienteId = 1;
    notasAsociadas = 0;
    entidadDevuelta = { id: 1, ...dtoValido, estado: true };

    queryBuilder = {
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
      create: vi.fn().mockImplementation((data) => ({ ...data })),
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

    notaRepository = {
      count: vi.fn().mockImplementation(async () => notasAsociadas),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [ClienteproveedorModule],
    })
      .overrideProvider(getRepositoryToken(Clienteproveedor))
      .useValue(repository)
      .overrideProvider(getRepositoryToken(Nota))
      .useValue(notaRepository)
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

  it('POST /clienteproveedor crea con estado activo por defecto', async () => {
    const response = await request(app.getHttpServer())
      .post('/clienteproveedor')
      .send(dtoValido)
      .expect(201);

    expect(response.body).toMatchObject(dtoValido);
    expect(response.body.estado).toBe(true);
    expect(response.body.id).toBe(1);
  });

  it('POST /clienteproveedor respeta el estado enviado', async () => {
    const response = await request(app.getHttpServer())
      .post('/clienteproveedor')
      .send({ ...dtoValido, tipo: 'proveedor', estado: false })
      .expect(201);

    expect(response.body.tipo).toBe('proveedor');
    expect(response.body.estado).toBe(false);
  });

  it('POST /clienteproveedor rechaza tipo, razón social y correo inválidos', async () => {
    const response = await request(app.getHttpServer())
      .post('/clienteproveedor')
      .send({ tipo: 'otro', razon_social: '', correo: 'no-es-correo' })
      .expect(400);

    expect(response.body.message).toBeDefined();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('POST /clienteproveedor rechaza campos no declarados', async () => {
    await request(app.getHttpServer())
      .post('/clienteproveedor')
      .send({ ...dtoValido, campoInexistente: 1 })
      .expect(400);
  });

  it('GET /clienteproveedor devuelve la estructura paginada', async () => {
    store.set(1, { id: 1, ...dtoValido, estado: true });

    const response = await request(app.getHttpServer())
      .get('/clienteproveedor')
      .query({ page: 1, limit: 3, search: 'Juan' })
      .expect(200);

    expect(response.body).toMatchObject({
      total: 1,
      page: 1,
      limit: 3,
      totalPages: 1,
      search: 'Juan',
    });
    expect(response.body.data).toHaveLength(1);
    expect(queryBuilder.andWhere).toHaveBeenCalled();
  });

  it('GET /clienteproveedor/:id devuelve el registro', async () => {
    const response = await request(app.getHttpServer())
      .get('/clienteproveedor/1')
      .expect(200);

    expect(response.body).toMatchObject({ id: 1, razon_social: 'Juan Pérez' });
  });

  it('GET /clienteproveedor/:id devuelve 404 si no existe', async () => {
    entidadDevuelta = null;

    const response = await request(app.getHttpServer())
      .get('/clienteproveedor/9999')
      .expect(404);

    expect(response.body.message).toBe('Cliente o proveedor no encontrado');
  });

  it('PATCH /clienteproveedor/:id actualiza parcialmente', async () => {
    const response = await request(app.getHttpServer())
      .patch('/clienteproveedor/1')
      .send({ razon_social: 'Juan Pérez Actualizado', telefono: '70000000' })
      .expect(200);

    expect(response.body.razon_social).toBe('Juan Pérez Actualizado');
    expect(response.body.correo).toBe('juan@mail.com');
  });

  it('PATCH /clienteproveedor/:id permite desactivar', async () => {
    const response = await request(app.getHttpServer())
      .patch('/clienteproveedor/1')
      .send({ estado: false })
      .expect(200);

    expect(response.body.estado).toBe(false);
  });

  it('DELETE /clienteproveedor/:id elimina si no tiene notas', async () => {
    await request(app.getHttpServer())
      .delete('/clienteproveedor/1')
      .expect(200);

    expect(repository.remove).toHaveBeenCalled();
  });

  it('DELETE /clienteproveedor/:id devuelve 409 si tiene notas asociadas', async () => {
    notasAsociadas = 1;

    const response = await request(app.getHttpServer())
      .delete('/clienteproveedor/1')
      .expect(409);

    expect(response.body.message).toContain('notas asociadas');
    expect(repository.remove).not.toHaveBeenCalled();
  });
});
