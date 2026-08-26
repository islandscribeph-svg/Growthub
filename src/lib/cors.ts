import { NextResponse } from "next/server";

// The /api/setup/* routes are meant to be called from a one-off local tool
// page (not the app itself), so they need permissive CORS. They're already
// gated by the setup key, so an open Access-Control-Allow-Origin doesn't
// widen what an attacker without that key can do.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-setup-key",
};

export function corsJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { ...init, headers: CORS_HEADERS });
}

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
