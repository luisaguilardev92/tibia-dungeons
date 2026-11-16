import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const localFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'local-saves.json');
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30_000 })
  : null;

let localSaves;

export async function initializeDatabase() {
  if (!pool) {
    if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production.');
    try { localSaves = JSON.parse(await readFile(localFile, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') localSaves = {}; else throw error; }
    return;
  }
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
}

export async function readSave(id) {
  if (pool) {
    const result = await pool.query('SELECT state FROM tibia_dungeons.game_saves WHERE save_id = $1', [id]);
    return result.rows[0]?.state ?? null;
  }
  return localSaves[id] ?? null;
}

export async function writeSave(id, state) {
  if (pool) {
    await pool.query(
      `INSERT INTO tibia_dungeons.game_saves (save_id, state) VALUES ($1, $2::jsonb)
       ON CONFLICT (save_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [id, JSON.stringify(state)],
    );
    return;
  }
  localSaves[id] = state;
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(path.dirname(localFile), { recursive: true });
  await writeFile(localFile, JSON.stringify(localSaves, null, 2), 'utf8');
}

export async function closeDatabase() {
  await pool?.end();
}

export const databaseMode = pool ? 'neon-postgres' : 'local-file';
