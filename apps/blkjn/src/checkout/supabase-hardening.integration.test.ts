import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getPool, migrate, resetDatabase } from "./db.ts";
import type pg from "pg";

const databaseUrl = process.env.BLKJN_TEST_DATABASE_URL
  ?? "postgresql://growthub:growthub@localhost:5432/blkjn_checkout_test";
const verifySql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../db/003_verify.sql"), "utf8");

async function expectDenied(pool: pg.Pool, role: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${role}`);
    for (const statement of [
      "SELECT id FROM orders",
      "INSERT INTO orders (id) VALUES ('00000000-0000-4000-8000-000000000099')",
      "UPDATE orders SET status = status",
      "DELETE FROM orders",
    ]) {
      await client.query("SAVEPOINT probe");
      let code = "";
      try {
        await client.query(statement);
      } catch (error) {
        code = (error as { code?: string }).code ?? "";
      }
      assert.equal(code, "42501", `${role} ${statement}`);
      await client.query("ROLLBACK TO SAVEPOINT probe");
    }
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

test("supabase API roles cannot read server tables and setup can run twice", async () => {
  const pool = getPool(databaseUrl);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
      END IF;
    END $$;
  `);
  await pool.query("ALTER ROLE service_role BYPASSRLS");
  await resetDatabase(pool);
  await pool.query(
    `INSERT INTO orders (
      id, public_ref, environment, access_token_hash, buyer_email, total_centavos,
      catalogue_version, status, payment_method, quote_expires_at, created_at, test_only
    ) VALUES (
      '00000000-0000-4000-8000-000000000010', 'BLKJN-SUPABASE-SETUP', 'test', 'hash',
      'buyer@example.com', 9900, '2026-11-08', 'AWAITING_PAYMENT', 'gcash', now(), now(), true
    )`,
  );
  await expectDenied(pool, "anon");
  await expectDenied(pool, "authenticated");
  await expectDenied(pool, "service_role");
  const owner = await pool.query("SELECT public_ref FROM orders WHERE id = '00000000-0000-4000-8000-000000000010'");
  assert.equal(owner.rows[0]?.public_ref, "BLKJN-SUPABASE-SETUP");
  await pool.query(verifySql);
  await migrate(pool);
  await pool.query(verifySql);
  const again = await pool.query("SELECT count(*)::int AS count FROM orders WHERE public_ref = 'BLKJN-SUPABASE-SETUP'");
  assert.equal(again.rows[0]?.count, 1);
});
