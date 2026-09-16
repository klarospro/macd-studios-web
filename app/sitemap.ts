import type { MetadataRoute } from "next";

const SITE_URL = "https://macdestudios.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/curso", "/invest", "/atlas", "/legal/aviso-legal", "/legal/privacidad", "/legal/cookies"];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.6,
  }));
}
