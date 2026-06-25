import type { NextConfig } from "next";

if (process.env.NODE_ENV === "production" && !process.env.BACKEND_URL) {
  console.warn(
    "[next.config.ts] BACKEND_URL non défini en production. "
    + "Le proxy /backend-api sera injoignable depuis Vercel."
  );
}

const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

/** Hôtes autorisés pour HMR / assets dev (IP LAN, domaine tunnel Cloudflare, etc.). */
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  compress: true,
  reactStrictMode: true,

  allowedDevOrigins,

  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  images: {
    formats: ["image/avif", "image/webp"],
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },

  // Proxy API en dev/prod : fetch('/backend-api/stats') → FastAPI
  // Le header ngrok-skip-browser-warning est injecté via src/middleware.ts
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
