import type { NextConfig } from "next";

// ATLAS vive en su propio proyecto de Vercel desde el 26/09/2026. Los enlaces
// viejos a macdestudios.com/atlas siguen funcionando: se redirigen allí.
const ATLAS = "https://atlas-capital-web.vercel.app";

const nextConfig: NextConfig = {
  // Recibos y contratos se suben por Server Action; el límite por defecto (1 MB) deja fuera
  // las fotos de móvil. 4 MB queda por debajo del límite de cuerpo de Vercel (4,5 MB).
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  async redirects() {
    return [
      { source: "/atlas", destination: ATLAS, permanent: false },
      { source: "/atlas/:path*", destination: `${ATLAS}/atlas/:path*`, permanent: false },
      { source: "/panel/atlas", destination: `${ATLAS}/panel/atlas`, permanent: false },
      { source: "/panel/atlas/:path*", destination: `${ATLAS}/panel/atlas/:path*`, permanent: false },
    ];
  },
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
