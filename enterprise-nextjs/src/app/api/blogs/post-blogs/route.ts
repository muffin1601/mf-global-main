import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { BUCKETS, storage } from "@/lib/storage";
import { EXTENSION, MIME, detectFileType } from "@/lib/files/signature";
import { legacyBlog } from "@/lib/marketing/blogs";

const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "post";
// Original multer filter: jpeg|jpg|png|webp by extension and MIME type, 5 MB max.
const allowedKinds = new Set(["jpeg", "png", "webp"]);

// POST /api/blogs/post-blogs — original route: authenticate + requireRole("admin").
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.enabled) return NextResponse.json({ message: "Authentication required" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  const title = String(form.get("title") ?? "").trim();
  const content = String(form.get("content") ?? "").trim();
  const author = String(form.get("author") ?? "").trim() || "Anonymous";
  if (!title || !content) return NextResponse.json({ error: "Title and content are required" }, { status: 400 });

  const media = form.get("media");
  let mediaPath: string | null = null;
  if (media instanceof File && media.size > 0) {
    if (media.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File too large" }, { status: 400 });
    const bytes = Buffer.from(await media.arrayBuffer());
    // Decide the type from the file's own bytes, never from the client-supplied name or MIME type.
    const kind = detectFileType(bytes);
    if (!kind || !allowedKinds.has(kind)) return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
    const path = `${Date.now()}-${randomUUID()}.${EXTENSION[kind]}`;
    try { await storage.upload(BUCKETS.blogMedia, path, bytes, MIME[kind]); } catch { return NextResponse.json({ error: "Media upload failed" }, { status: 503 }); }
    mediaPath = storage.publicUrl(BUCKETS.blogMedia, path);
  }

  const post = await prisma.blogPost.create({ data: { title, content, author, mediaPath, slug: `${slugify(title)}-${randomUUID().slice(0, 8)}`, published: true } });
  return NextResponse.json(legacyBlog(post), { status: 201 });
}
