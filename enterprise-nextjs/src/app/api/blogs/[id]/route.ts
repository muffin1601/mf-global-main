import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { blogLookup, legacyBlog } from "@/lib/marketing/blogs";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await prisma.blogPost.findFirst({ where: { published: true, ...blogLookup(id) } });
  if (!post) return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  return NextResponse.json(legacyBlog(post));
}
