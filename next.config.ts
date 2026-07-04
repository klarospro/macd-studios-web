import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "cdn.pixabay.com" },
    ],
  },
};

export default nextConfig;
