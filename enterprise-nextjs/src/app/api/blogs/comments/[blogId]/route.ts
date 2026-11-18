import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { blogLookup } from "@/lib/marketing/blogs";

export const dynamic = "force-dynamic";

// Original: Comment.find({ blogId }).sort({ createdAt: -1 }) — newest first.
export async function GET(_request: Request, { params }: { params: Promise<{ blogId: string }> }) {
  const { blogId } = await params;
  const blog = await prisma.blogPost.findFirst({ where: blogLookup(blogId), select: { id: true } });
  if (!blog) return NextResponse.json([]);
  const comments = await prisma.blogComment.findMany({ where: { blogId: blog.id, approved: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(comments.map((comment) => ({ _id: comment.legacyId ?? comment.id, blogId, user: comment.userName, text: comment.text, createdAt: comment.createdAt })));
}
