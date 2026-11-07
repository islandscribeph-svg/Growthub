import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const pools = new Map<string, pg.Pool>();

export function getPool(databaseUrl: string): pg.Pool {
  const existing = pools.get(databaseUrl);
  if (existing) return existing;
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 8 });
  pools.set(databaseUrl, pool);
  return pool;
}

export async function migrate(pool: pg.Pool): Promise<void> {
  const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "../../db/001_init.sql");
  const sql = readFileSync(sqlPath, "utf8");
  await pool.query(sql);
  await pool.query(
    "INSERT INTO schema_migrations (id) VALUES ('001_init') ON CONFLICT (id) DO NOTHING",
  );
}

export async function resetDatabase(pool: pg.Pool): Promise<void> {
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await migrate(pool);
}
