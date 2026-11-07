import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AppConfig } from "./config.ts";

export type StoredObject = { objectKey: string; sha256: string };

export type ObjectStore = {
  driver: "local-test" | "s3";
  production: boolean;
  putPrivate(input: { orderId: string; bytes: Buffer }): Promise<StoredObject>;
  getPrivate(objectKey: string): Promise<Buffer | null>;
};

function localStore(root: string): ObjectStore {
  const base = resolve(root);
  return {
    driver: "local-test",
    production: false,
    async putPrivate({ orderId, bytes }) {
      const objectKey = `receipts/${orderId}/${randomUUID()}`;
      const path = resolve(base, objectKey);
      if (!path.startsWith(`${base}/`)) throw new Error("unsafe object key");
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, bytes);
      return { objectKey, sha256: createHash("sha256").update(bytes).digest("hex") };
    },
    async getPrivate(objectKey) {
      const path = resolve(base, objectKey);
      if (!path.startsWith(`${base}/`)) return null;
      try {
        return await readFile(path);
      } catch {
        return null;
      }
    },
  };
}

export function createStorage(config: AppConfig): ObjectStore | null {
  if (config.storageDriver === "local-test" && config.mode === "test" && config.storageRoot) {
    return localStore(config.storageRoot);
  }
  if (
    config.storageDriver === "s3" &&
    config.s3Endpoint &&
    config.s3Bucket &&
    config.s3AccessKey &&
    config.s3SecretKey
  ) {
    return {
      driver: "s3",
      production: true,
      async putPrivate() {
        throw new Error("s3_adapter_requires_runtime_call");
      },
      async getPrivate() {
        return null;
      },
    };
  }
  return null;
}

export function sniffReceipt(bytes: Buffer, maxBytes: number): { ok: true; contentType: string } | { ok: false; reason: string } {
  if (bytes.length < 4 || bytes.length > maxBytes) return { ok: false, reason: "invalid_receipt_size" };
  if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return { ok: true, contentType: "image/png" };
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { ok: true, contentType: "image/jpeg" };
  if (bytes.subarray(0, 4).toString("utf8") === "%PDF") return { ok: true, contentType: "application/pdf" };
  return { ok: false, reason: "unsupported_receipt_type" };
}
