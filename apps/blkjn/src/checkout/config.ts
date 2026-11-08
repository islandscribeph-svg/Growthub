export type AppConfig = {
  mode: "test" | "live";
  databaseUrl: string | null;
  purchaseLive: boolean;
  requestIntakeLive: boolean;
  fulfillmentLive: boolean;
  maxQuantity: number | null;
  quoteTtlMinutes: number | null;
  paymentWindowHours: number | null;
  clockSkewMinutes: number | null;
  minConfidence: number | null;
  receiptMaxBytes: number | null;
  storageDriver: "unset" | "local-test" | "s3";
  storageRoot: string | null;
  s3Endpoint: string | null;
  s3Bucket: string | null;
  s3AccessKey: string | null;
  s3SecretKey: string | null;
  s3Region: string;
  makeSigningSecret: string | null;
  recipientName: string | null;
  gcashIdentifier: string | null;
  gotymeIdentity: string | null;
  gotymeSuffix: string | null;
  gcashQrConfigured: boolean;
  gotymeQrConfigured: boolean;
  requestRatePerHour: number | null;
  downloadTtlMinutes: number | null;
  downloadMaxCount: number | null;
  deliverableRoot: string | null;
};

function flag(value: string | undefined): boolean {
  return value === "true";
}

function integerOrNull(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

function decimalOrNull(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const mode = env.BLKJN_MODE === "test" ? "test" : "live";
  const storageDriver = env.BLKJN_STORAGE_DRIVER === "s3" || env.BLKJN_STORAGE_DRIVER === "local-test"
    ? env.BLKJN_STORAGE_DRIVER
    : "unset";
  return {
    mode,
    databaseUrl: env.BLKJN_DATABASE_URL?.trim() || null,
    purchaseLive: flag(env.BLKJN_PURCHASE_LIVE),
    requestIntakeLive: flag(env.BLKJN_REQUEST_INTAKE_LIVE),
    fulfillmentLive: flag(env.BLKJN_FULFILLMENT_LIVE),
    maxQuantity: integerOrNull(env.BLKJN_MAX_QUANTITY),
    quoteTtlMinutes: integerOrNull(env.BLKJN_QUOTE_TTL_MINUTES),
    paymentWindowHours: integerOrNull(env.BLKJN_PAYMENT_WINDOW_HOURS),
    clockSkewMinutes: integerOrNull(env.BLKJN_CLOCK_SKEW_MINUTES),
    minConfidence: decimalOrNull(env.BLKJN_MIN_CONFIDENCE),
    receiptMaxBytes: integerOrNull(env.BLKJN_RECEIPT_MAX_BYTES),
    storageDriver,
    storageRoot: env.BLKJN_STORAGE_ROOT?.trim() || null,
    s3Endpoint: env.BLKJN_S3_ENDPOINT?.trim() || null,
    s3Bucket: env.BLKJN_S3_BUCKET?.trim() || null,
    s3AccessKey: env.BLKJN_S3_ACCESS_KEY?.trim() || null,
    s3SecretKey: env.BLKJN_S3_SECRET_KEY?.trim() || null,
    s3Region: env.BLKJN_S3_REGION?.trim() || "auto",
    makeSigningSecret: env.BLKJN_MAKE_SIGNING_SECRET?.trim() || null,
    recipientName: env.BLKJN_RECIPIENT_NAME?.trim() || null,
    gcashIdentifier: env.BLKJN_GCASH_IDENTIFIER?.trim() || null,
    gotymeIdentity: env.BLKJN_GOTYME_IDENTITY?.trim() || null,
    gotymeSuffix: env.BLKJN_GOTYME_SUFFIX?.trim() || null,
    gcashQrConfigured: flag(env.BLKJN_GCASH_QR_CONFIGURED),
    gotymeQrConfigured: flag(env.BLKJN_GOTYME_QR_CONFIGURED),
    requestRatePerHour: integerOrNull(env.BLKJN_REQUEST_RATE_PER_HOUR),
    downloadTtlMinutes: integerOrNull(env.BLKJN_DOWNLOAD_TTL_MINUTES),
    downloadMaxCount: integerOrNull(env.BLKJN_DOWNLOAD_MAX_COUNT),
    deliverableRoot: env.BLKJN_DELIVERABLE_ROOT?.trim() || null,
  };
}

export function configurationGaps(config: AppConfig): string[] {
  const gaps: string[] = [];
  if (!config.databaseUrl) gaps.push("BLKJN_DATABASE_URL");
  if (config.maxQuantity === null) gaps.push("BLKJN_MAX_QUANTITY");
  if (config.quoteTtlMinutes === null) gaps.push("BLKJN_QUOTE_TTL_MINUTES");
  if (!config.makeSigningSecret) gaps.push("BLKJN_MAKE_SIGNING_SECRET");
  if (config.storageDriver === "unset") gaps.push("BLKJN_STORAGE_DRIVER");
  if (config.storageDriver === "local-test" && config.mode !== "test") gaps.push("BLKJN_STORAGE_DRIVER");
  if (config.storageDriver === "s3" && (!config.s3Endpoint || !config.s3Bucket || !config.s3AccessKey || !config.s3SecretKey)) {
    gaps.push("BLKJN_S3_ENDPOINT");
  }
  return gaps;
}
