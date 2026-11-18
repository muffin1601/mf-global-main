import type { Metadata } from "next";
import BlogDetail from "@/legacy-marketing/pages/BlogDetail";
import { prisma } from "@/lib/prisma/client";
import { blogLookup } from "@/lib/marketing/blogs";
import { marketingMetadata } from "../../_meta";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const fallback = marketingMetadata("Insights | MF Global Services", "Read insights from MF Global Services.", `/blogs/${slug}`);
  try {
    const post = await prisma.blogPost.findFirst({
      where: { published: true, ...blogLookup(slug) },
      select: { title: true, content: true },
    });
    if (!post) return fallback;
    return marketingMetadata(`${post.title} | MF Global Services`, post.content.slice(0, 155) || "Read insights from MF Global Services.", `/blogs/${slug}`);
  } catch {
    return fallback;
  }
}

export default function BlogDetailPage() {
  return <BlogDetail />;
}
