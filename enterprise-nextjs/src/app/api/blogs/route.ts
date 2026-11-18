import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { legacyBlog } from "@/lib/marketing/blogs";

export const dynamic = "force-dynamic";

// GET /api/blogs — original: Blog.find().sort({ createdAt: -1 })
export async function GET() {
  const posts = await prisma.blogPost.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(posts.map(legacyBlog));
}
