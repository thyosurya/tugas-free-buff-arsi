import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  /*
   * Cache Components dimatikan dengan sengaja.
   * Pada mode itu Next mengirim shell prerender ber-status 200 lalu mengalirkan
   * konten dinamis, sehingga redirect() untuk pengunjung tanpa login dan
   * notFound() untuk sesi yang tidak ada tidak pernah terbaca sebagai status
   * HTTP 307/404 — hanya sebagai payload flight yang butuh JavaScript.
   */
  cacheComponents: false,
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
