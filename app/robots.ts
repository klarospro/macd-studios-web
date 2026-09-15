import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/panel", "/api"],
      },
    ],
    sitemap: "https://macdestudios.com/sitemap.xml",
  };
}
