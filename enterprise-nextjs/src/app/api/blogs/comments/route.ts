import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { blogLookup } from "@/lib/marketing/blogs";

const schema = z.object({ blogId: z.string().min(1).max(100), user: z.string().trim().max(120).optional(), text: z.string().trim().min(1).max(3000) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  const blog = await prisma.blogPost.findFirst({ where: { published: true, ...blogLookup(parsed.data.blogId) }, select: { id: true } });
  if (!blog) return NextResponse.json({ error: "Blog not found" }, { status: 400 });
  // Original Comment model: user defaults to "Guest".
  const comment = await prisma.blogComment.create({ data: { blogId: blog.id, userName: parsed.data.user || "Guest", text: parsed.data.text, approved: true } });
  return NextResponse.json({ _id: comment.id, blogId: parsed.data.blogId, user: comment.userName, text: comment.text, createdAt: comment.createdAt }, { status: 201 });
}
