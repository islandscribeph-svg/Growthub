import assert from "node:assert/strict";
import test from "node:test";
import { databasePoolOptions } from "./db.ts";

test("transaction pooler uses one connection and verify-full stays enabled", () => {
  const pooled = databasePoolOptions(
    "postgresql://postgres.example:secret@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=verify-full",
  );
  assert.equal(pooled.max, 1);
  assert.equal(String(pooled.connectionString).includes("sslmode=verify-full"), true);

  const direct = databasePoolOptions("postgresql://growthub:growthub@localhost:5432/blkjn_checkout_test");
  assert.equal(direct.max, 8);
});

test("a connection string that skips certificate checks is rejected", () => {
  assert.throws(
    () => databasePoolOptions("postgresql://postgres.example:secret@db.example.supabase.co:5432/postgres?sslmode=no-verify"),
    /certificate verification/,
  );
  assert.throws(
    () => databasePoolOptions("postgresql://postgres.example:secret@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?uselibpqcompat=true&sslmode=require"),
    /certificate verification/,
  );
});
