-- Datos ficticios para probar el módulo de notas (PostgreSQL)
-- Ejecutar DESPUÉS de las migraciones: npm run migration:run
-- Los IDs 9001+ evitan chocar con datos reales. El script es reejecutable (ON CONFLICT DO NOTHING).

BEGIN;

-- Usuario de prueba. Contraseña: Notas2026!  (hash bcrypt cost=10)
INSERT INTO "users" ("id", "name", "email", "password", "status")
VALUES (9001, 'Ana Notas', 'notas.demo.9001@mail.com',
        '$2b$10$HO1F1R37n7cuvGjm5b8T7.d5NaTafTbdfZwONgIeIAens4HuQ/13q', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "roles" ("id", "name", "descripcion")
VALUES (9001, 'ROL_NOTAS_DEMO', 'Rol ficticio para pruebas de notas')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "users_roles" ("user_id", "role_id")
VALUES (9001, 9001)
ON CONFLICT DO NOTHING;

-- Infraestructura
INSERT INTO "sucursales" ("id", "nombre", "direccion", "telefono", "ciudad")
VALUES (9001, 'Sucursal Demo Notas', 'Av. Central 123', '77700001', 'La Paz')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "categorias" ("id", "nombre", "descripcion")
VALUES (9001, 'Mercadería demo', 'Productos ficticios para notas')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "almacen" ("id", "nombre", "codigo", "descripcion", "sucursalId")
VALUES (9001, 'Almacén Demo Notas', 'ALM-DEMO-9001', 'Almacén ficticio', 9001)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "productos"
  ("id", "nombre", "descripcion", "codigo_barra", "unidad_medida", "marca",
   "precio_venta_actual", "imagen", "estado", "categoriaId")
VALUES
  (9001, 'Arroz grano largo', 'Arroz ficticio de primera calidad', '775000000001', 'kg', 'Campo Demo', 250.50, NULL, true, 9001),
  (9002, 'Aceite de girasol', 'Aceite ficticio 1 L', '775000000002', 'lt', 'Sol Demo', 95.00, NULL, true, 9001)
ON CONFLICT (id) DO NOTHING;

-- Stock final = resultado de los movimientos de las notas ficticias:
--   Arroz: +10 (compra) -4 (venta) +2 (devolución) = 8
--   Aceite: +5 (compra) = 5
INSERT INTO "almacen_producto"
  ("id", "cantidad_actual", "fecha_actualizacion", "almacenId", "productoId")
VALUES
  (9001, 8, '2026-11-24', 9001, 9001),
  (9002, 5, '2026-11-24', 9001, 9002)
ON CONFLICT (id) DO NOTHING;

-- Cliente y proveedor
INSERT INTO "clienteproveedor"
  ("id", "tipo", "razon_social", "identificacion", "direccion", "telefono", "correo", "estado")
VALUES
  (9001, 'proveedor', 'Distribuidora Demo SRL', 'RUC-9001', 'Av. Proveedores 45', '77710001', 'proveedor.demo@mail.com', true),
  (9002, 'cliente', 'Cliente Demo', 'CI-9002', 'Calle Clientes 78', '77710002', 'cliente.demo@mail.com', true)
ON CONFLICT (id) DO NOTHING;

-- Notas de prueba
INSERT INTO "notas"
  ("id", "fecha", "tipo_nota", "estado_nota", "observaciones", "clienteproveedorId", "userId")
VALUES
  (9001, '2026-11-20 09:30:00', 'compra', 'pendiente', 'Compra ficticia de mercadería', 9001, 9001),
  (9002, '2026-11-22 15:10:00', 'venta', 'aprobada', 'Venta ficticia a cliente demo', 9002, 9001),
  (9003, '2026-11-24 11:45:00', 'devolucion', 'anulada', 'Devolución ficticia anulada para probar filtros', 9002, 9001)
ON CONFLICT (id) DO NOTHING;

-- Movimientos (coherentes con el stock cargado arriba)
INSERT INTO "movimientos"
  ("id", "cantidad", "tipo_movimiento", "precio_compra", "precio_venta", "observaciones", "notaId", "productoId", "almacenId")
VALUES
  (9001, 10, 'ingreso', 180.00, 250.50, 'Ingreso por compra', 9001, 9001, 9001),
  (9002, 5,  'ingreso', 70.00,  95.00,  'Ingreso por compra', 9001, 9002, 9001),
  (9003, 4,  'salida',  180.00, 250.50, 'Salida por venta',   9002, 9001, 9001),
  (9004, 2,  'devolucion', 180.00, 250.50, 'Devolución del cliente', 9003, 9001, 9001)
ON CONFLICT (id) DO NOTHING;

-- Alinear secuencias para que los próximos INSERT no choquen con estos IDs
SELECT setval(pg_get_serial_sequence('"users"', 'id'), GREATEST((SELECT MAX(id) FROM "users"), 1));
SELECT setval(pg_get_serial_sequence('"roles"', 'id'), GREATEST((SELECT MAX(id) FROM "roles"), 1));
SELECT setval(pg_get_serial_sequence('"sucursales"', 'id'), GREATEST((SELECT MAX(id) FROM "sucursales"), 1));
SELECT setval(pg_get_serial_sequence('"categorias"', 'id'), GREATEST((SELECT MAX(id) FROM "categorias"), 1));
SELECT setval(pg_get_serial_sequence('"almacen"', 'id'), GREATEST((SELECT MAX(id) FROM "almacen"), 1));
SELECT setval(pg_get_serial_sequence('"productos"', 'id'), GREATEST((SELECT MAX(id) FROM "productos"), 1));
SELECT setval(pg_get_serial_sequence('"almacen_producto"', 'id'), GREATEST((SELECT MAX(id) FROM "almacen_producto"), 1));
SELECT setval(pg_get_serial_sequence('"clienteproveedor"', 'id'), GREATEST((SELECT MAX(id) FROM "clienteproveedor"), 1));
SELECT setval(pg_get_serial_sequence('"notas"', 'id'), GREATEST((SELECT MAX(id) FROM "notas"), 1));
SELECT setval(pg_get_serial_sequence('"movimientos"', 'id'), GREATEST((SELECT MAX(id) FROM "movimientos"), 1));

COMMIT;

-- ---------------------------------------------------------------------------
-- LIMPIEZA (opcional). Ejecutar por separado si quieres borrar solo estos datos:
--
-- DELETE FROM "movimientos" WHERE "notaId" BETWEEN 9001 AND 9003;
-- DELETE FROM "notas" WHERE id BETWEEN 9001 AND 9003;
-- DELETE FROM "almacen_producto" WHERE "almacenId" = 9001;
-- DELETE FROM "productos" WHERE id IN (9001, 9002);
-- DELETE FROM "almacen" WHERE id = 9001;
-- DELETE FROM "categorias" WHERE id = 9001;
-- DELETE FROM "sucursales" WHERE id = 9001;
-- DELETE FROM "users_roles" WHERE "user_id" = 9001;
-- DELETE FROM "users" WHERE id = 9001;
-- DELETE FROM "roles" WHERE id = 9001;
-- DELETE FROM "clienteproveedor" WHERE id IN (9001, 9002);
