import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  // Keep this build inside apps/blkjn. The repository root has its own
  // Next.js app and lockfile, and must not be compiled with this one.
  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
