import { readConfig, type AppConfig } from "./config.ts";
import { getPool } from "./db.ts";
import type { Mailer } from "./service.ts";
import { createStorage, type ObjectStore } from "./storage.ts";
import type pg from "pg";

export function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

export function runtimeDeps(env: NodeJS.ProcessEnv = process.env): {
  config: AppConfig;
  pool: pg.Pool | null;
  storage: ObjectStore | null;
  mailer?: Mailer;
} {
  const config = readConfig(env);
  return {
    config,
    pool: config.databaseUrl ? getPool(config.databaseUrl) : null,
    storage: createStorage(config),
  };
}

export function unavailable(): Response {
  return json(503, {
    error: "configuration_unavailable",
    detail: "BLKJN checkout storage is not configured. Nothing was saved.",
  });
}
