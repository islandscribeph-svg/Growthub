import assert from "node:assert/strict";
import test from "node:test";
import { createS3ObjectStore, type S3Sender } from "./storage.ts";
import { readConfig } from "./config.ts";
import { createStorage } from "./storage.ts";

const orderId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

function fakeSender() {
  const objects = new Map<string, Buffer>();
  const calls: string[] = [];
  const sender: S3Sender = {
    async put({ key, body }) {
      calls.push(`put:${key}:${body.length}`);
      objects.set(key, Buffer.from(body));
    },
    async get({ key }) {
      calls.push(`get:${key}`);
      return objects.get(key) ?? null;
    },
  };
  return { sender, objects, calls };
}

test("s3 adapter uploads under the order prefix and refuses another order's key", async () => {
  const fake = fakeSender();
  const store = createS3ObjectStore(fake.sender, { bucket: "blkjn-private", maxBytes: 1000 });
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const saved = await store.putPrivate({ orderId, bytes: png, contentType: "image/png" });
  assert.match(saved.objectKey, new RegExp(`^receipts/${orderId}/`));
  assert.equal((await store.getPrivate(saved.objectKey, orderId))?.equals(png), true);
  assert.equal(await store.getPrivate(saved.objectKey, otherId), null);
  assert.equal(fake.calls.some((call) => call.startsWith(`get:receipts/${otherId}`)), false);
  assert.equal(fake.calls.filter((call) => call.startsWith("get:")).length, 1);
});

test("s3 adapter rejects oversized bytes before sending", async () => {
  const fake = fakeSender();
  const store = createS3ObjectStore(fake.sender, { bucket: "blkjn-private", maxBytes: 4 });
  await assert.rejects(
    store.putPrivate({ orderId, bytes: Buffer.alloc(5), contentType: "image/png" }),
    /invalid_receipt_size/,
  );
  assert.equal(fake.calls.length, 0);
});

test("configured s3 env selects the production driver and incomplete env does not", () => {
  const ready = createStorage(readConfig({
    BLKJN_STORAGE_DRIVER: "s3",
    BLKJN_S3_ENDPOINT: "https://storage.example.invalid",
    BLKJN_S3_BUCKET: "blkjn-private",
    BLKJN_S3_ACCESS_KEY: "key",
    BLKJN_S3_SECRET_KEY: "secret",
    BLKJN_RECEIPT_MAX_BYTES: "1000",
  }));
  assert.equal(ready?.driver, "s3");
  assert.equal(ready?.production, true);
  assert.equal(createStorage(readConfig({ BLKJN_STORAGE_DRIVER: "s3", BLKJN_S3_BUCKET: "only-bucket" })), null);
});
