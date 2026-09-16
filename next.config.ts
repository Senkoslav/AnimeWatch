import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    remotePatterns: [
      // Постеры из Shikimori в seed. Где хранить свои постеры — открытый вопрос в docs/06.
      { protocol: "https", hostname: "shikimori.io", pathname: "/system/animes/**" },
    ],
  },
};

export default nextConfig;
