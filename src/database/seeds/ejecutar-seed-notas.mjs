// Carga los datos ficticios de notas usando las variables BD_* de .env
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const ruta = join(dirname(fileURLToPath(import.meta.url)), 'datos_ficticios_notas.sql');
const sql = await readFile(ruta, 'utf8');

const client = new Client({
  host: process.env.BD_HOST,
  port: Number(process.env.BD_PORT ?? 5432),
  user: process.env.BD_USERNAME,
  password: process.env.BD_PASSWORD,
  database: process.env.BD_DATABASE,
});

try {
  await client.connect();
  await client.query(sql);
  console.log('OK: datos ficticios de notas cargados (IDs 9001+).');
  console.log('Login: notas.demo.9001@mail.com / Notas2026!');
} catch (error) {
  console.error('No se pudo cargar el seed:', error);
  process.exitCode = 1;
} finally {
  await client.end();
}
