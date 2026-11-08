import { configurationGaps, readConfig } from "../../../../checkout/config.ts";
import { json } from "../../../../checkout/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const config = readConfig();
  const configured = Boolean(config.databaseUrl && config.maxQuantity !== null && config.quoteTtlMinutes !== null);
  const checkout = !configured
    ? "unavailable"
    : config.purchaseLive && config.mode === "live"
      ? "live"
      : config.mode === "test"
        ? "test"
        : "disabled";
  return json(200, {
    checkout,
    requestIntake: config.requestIntakeLive ? "live" : "disabled",
    fulfillment: config.fulfillmentLive ? "live" : "disabled",
    purchaseLive: config.purchaseLive,
    qr: {
      gcash: config.gcashQrConfigured,
      gotyme: config.gotymeQrConfigured,
    },
    gaps: configurationGaps(config),
  });
}
