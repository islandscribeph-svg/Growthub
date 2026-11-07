import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AppConfig } from "./config.ts";

export type StoredObject = { objectKey: string; sha256: string };

export type ObjectStore = {
  driver: "local-test" | "s3";
  production: boolean;
  putPrivate(input: { orderId: string; bytes: Buffer; contentType: string }): Promise<StoredObject>;
  getPrivate(objectKey: string, orderId: string): Promise<Buffer | null>;
};

export type S3Sender = {
  put(input: { bucket: string; key: string; body: Buffer; contentType: string }): Promise<void>;
  get(input: { bucket: string; key: string }): Promise<Buffer | null>;
};

const orderKey = /^receipts\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/;

export function receiptKeyFor(orderId: string, objectKey: string): boolean {
  return orderKey.test(objectKey) && objectKey.startsWith(`receipts/${orderId}/`) && !objectKey.includes("..");
}

function localStore(root: string): ObjectStore {
  const base = resolve(root);
  return {
    driver: "local-test",
    production: false,
    async putPrivate({ orderId, bytes }) {
      const objectKey = `receipts/${orderId}/${randomUUID()}`;
      if (!receiptKeyFor(orderId, objectKey)) throw new Error("unsafe object key");
      const path = resolve(base, objectKey);
      if (!path.startsWith(`${base}/`)) throw new Error("unsafe object key");
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, bytes);
      return { objectKey, sha256: createHash("sha256").update(bytes).digest("hex") };
    },
    async getPrivate(objectKey, orderId) {
      if (!receiptKeyFor(orderId, objectKey)) return null;
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

export function createS3ObjectStore(
  sender: S3Sender,
  options: { bucket: string; maxBytes: number },
): ObjectStore {
  return {
    driver: "s3",
    production: true,
    async putPrivate({ orderId, bytes, contentType }) {
      if (bytes.length < 1 || bytes.length > options.maxBytes) throw new Error("invalid_receipt_size");
      const objectKey = `receipts/${orderId}/${randomUUID()}`;
      if (!receiptKeyFor(orderId, objectKey)) throw new Error("unsafe object key");
      await sender.put({ bucket: options.bucket, key: objectKey, body: bytes, contentType });
      return { objectKey, sha256: createHash("sha256").update(bytes).digest("hex") };
    },
    async getPrivate(objectKey, orderId) {
      if (!receiptKeyFor(orderId, objectKey)) return null;
      return sender.get({ bucket: options.bucket, key: objectKey });
    },
  };
}

export function s3SenderFromClient(client: S3Client): S3Sender {
  return {
    async put({ bucket, key, body, contentType }) {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }));
    },
    async get({ bucket, key }) {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!response.Body) return null;
        return Buffer.from(await response.Body.transformToByteArray());
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number }; name?: string }).name;
        const code = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === "NoSuchKey" || status === "NotFound" || code === 404) return null;
        throw error;
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
    config.s3SecretKey &&
    config.receiptMaxBytes !== null
  ) {
    const client = new S3Client({
      region: config.s3Region,
      endpoint: config.s3Endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.s3AccessKey,
        secretAccessKey: config.s3SecretKey,
      },
    });
    return createS3ObjectStore(s3SenderFromClient(client), {
      bucket: config.s3Bucket,
      maxBytes: config.receiptMaxBytes,
    });
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
