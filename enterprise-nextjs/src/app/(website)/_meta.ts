import type { Metadata } from "next";

// Mirrors useMarketingMeta() from the original frontend: title, description and
// og:title / og:description / og:type / og:url / og:image (logo by default).
export function marketingMetadata(title: string, description: string, path: string, image = "/assets/logo.webp"): Metadata {
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, type: "website", url: path, images: [image] },
  };
}
