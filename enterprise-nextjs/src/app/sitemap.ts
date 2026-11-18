import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma/client";

export const dynamic = "force-dynamic";

// The original static sitemap.xml listed "/", "/about", "/services" and "/contact".
// "/about" and "/services" never existed as routes in the original React app
// (they rendered an empty page), so the sitemap lists the real public pages plus
// every published blog post at its original URL (/blogs/<original Mongo id>).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://mfglobalservices.com";
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/blogs`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/careers`, changeFrequency: "weekly", priority: 0.7 },
  ];
  try {
    const posts = await prisma.blogPost.findMany({ where: { published: true }, select: { id: true, legacyId: true, updatedAt: true } });
    return pages.concat(posts.map((post) => ({ url: `${base}/blogs/${post.legacyId ?? post.id}`, lastModified: post.updatedAt, changeFrequency: "monthly", priority: 0.6 })));
  } catch (error) {
    console.error("sitemap: blog posts unavailable", error instanceof Error ? error.message : String(error));
    return pages;
  }
}
