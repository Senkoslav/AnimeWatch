import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    remotePatterns: [
      // Постеры Shikimori. GraphQL отдаёт их по /uploads/, старый REST отдавал по /system/ —
      // в базе могут остаться оба пути, поэтому разрешены оба.
      { protocol: "https", hostname: "shikimori.io", pathname: "/uploads/**" },
      { protocol: "https", hostname: "shikimori.io", pathname: "/system/animes/**" },
    ],
  },
};

export default nextConfig;
