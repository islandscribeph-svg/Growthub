import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const pools = new Map<string, pg.Pool>();
const sqlDirectory = join(dirname(fileURLToPath(import.meta.url)), "../../db");

export function databasePoolOptions(databaseUrl: string): pg.PoolConfig {
  const params = new URLSearchParams(databaseUrl.split("?")[1] ?? "");
  const sslmode = params.get("sslmode");
  const libpqCompat = params.get("uselibpqcompat") === "true";
  const disablesVerification = sslmode === "no-verify"
    || (libpqCompat && (sslmode === "require" || sslmode === "prefer") && !params.get("sslrootcert"));
  if (disablesVerification) {
    throw new Error("BLKJN_DATABASE_URL disables TLS certificate verification");
  }
  return {
    connectionString: databaseUrl,
    max: connectionPort(databaseUrl) === 6543 ? 1 : 8,
  };
}

function connectionPort(databaseUrl: string): number | null {
  const hostAndPath = databaseUrl.slice(databaseUrl.lastIndexOf("@") + 1);
  const match = hostAndPath.match(/:(\d+)(?:\/|$)/);
  return match ? Number(match[1]) : null;
}

export function getPool(databaseUrl: string): pg.Pool {
  const existing = pools.get(databaseUrl);
  if (existing) return existing;
  const pool = new pg.Pool(databasePoolOptions(databaseUrl));
  pools.set(databaseUrl, pool);
  return pool;
}

export async function migrate(pool: pg.Pool): Promise<void> {
  for (const fileName of ["001_init.sql", "002_supabase_hardening.sql"]) {
    await pool.query(readFileSync(join(sqlDirectory, fileName), "utf8"));
  }
}

export async function resetDatabase(pool: pg.Pool): Promise<void> {
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await migrate(pool);
}
