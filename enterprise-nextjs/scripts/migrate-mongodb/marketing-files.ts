// Copies marketing-website files that the record migration (index.ts) only
// references, so the public site no longer depends on the old Express server:
//
//   1. Blog media: blog_posts.media_path values that still point at the old
//      backend (".../uploads/blogs/...") are downloaded and re-uploaded to the
//      public Supabase bucket `blog-media`; media_path is updated.
//   2. Resumes: careerapplications.resume.data (stored inside MongoDB) is
//      uploaded to the private bucket `career-resumes` at the resume_path that
//      index.ts already wrote ("legacy-resumes/<mongo id>").
//   3. Careers admin PIN: careersettings{key:"admin"}.pinHash (bcrypt) is copied
//      into career_admin_settings so the existing PIN keeps working.
//
// MongoDB is only read. Dry run by default; pass --apply to write to Supabase.
// Run after `prisma migrate deploy` and `npm run migrate:mongo:apply`.
//   npx tsx scripts/migrate-mongodb/marketing-files.ts [--apply]
import "dotenv/config";
import { Binary, MongoClient, ObjectId } from "mongodb";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const apply = process.argv.includes("--apply");
const required = ["LEGACY_MONGODB_URI", "LEGACY_MONGODB_DATABASE", "DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const;
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing required environment variable names: ${missing.join(", ")}`);

const mongo = new MongoClient(process.env.LEGACY_MONGODB_URI!, { readPreference: "secondaryPreferred", serverSelectionTimeoutMS: 15_000 });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
const report = { mode: apply ? "apply" : "dry-run", blogMedia: { candidates: 0, copied: 0, failed: [] as string[] }, resumes: { candidates: 0, copied: 0, failed: [] as string[] }, pin: "not found" };

const resumeTypes: Record<string, string> = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

async function blogMedia() {
  const posts = await prisma.blogPost.findMany({ where: { mediaPath: { not: null } }, select: { id: true, legacyId: true, mediaPath: true } });
  for (const post of posts) {
    const url = post.mediaPath!;
    let parsed: URL;
    try { parsed = new URL(url); } catch { report.blogMedia.failed.push(`${post.id}: not an absolute URL`); continue; }
    if (parsed.host === supabaseHost) continue;
    report.blogMedia.candidates++;
    if (!apply) continue;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "application/octet-stream";
      const name = parsed.pathname.split("/").pop() || `${post.legacyId ?? post.id}`;
      const path = `legacy/${post.legacyId ?? post.id}-${name}`;
      const { error } = await supabase.storage.from("blog-media").upload(path, await response.arrayBuffer(), { contentType, upsert: true });
      if (error) throw error;
      const publicUrl = supabase.storage.from("blog-media").getPublicUrl(path).data.publicUrl;
      await prisma.blogPost.update({ where: { id: post.id }, data: { mediaPath: publicUrl } });
      report.blogMedia.copied++;
    } catch (error) {
      report.blogMedia.failed.push(`${post.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function resumes(db: ReturnType<MongoClient["db"]>) {
  const cursor = db.collection("careerapplications").find({ "resume.data": { $exists: true } }, { projection: { _id: 1, resume: 1 } });
  for await (const doc of cursor) {
    const legacyId = doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id);
    const application = await prisma.careerApplication.findUnique({ where: { legacyId }, select: { resumePath: true } });
    if (!application?.resumePath) { report.resumes.failed.push(`${legacyId}: application not migrated`); continue; }
    report.resumes.candidates++;
    if (!apply) continue;
    try {
      const data = doc.resume?.data;
      const bytes = data instanceof Binary ? Buffer.from(data.buffer) : Buffer.isBuffer(data) ? data : null;
      if (!bytes) throw new Error("resume binary missing");
      const ext = String(doc.resume?.filename ?? "").split(".").pop()?.toLowerCase() ?? "";
      const contentType = String(doc.resume?.contentType ?? resumeTypes[ext] ?? "application/octet-stream");
      const { error } = await supabase.storage.from("career-resumes").upload(application.resumePath, bytes, { contentType, upsert: true });
      if (error) throw error;
      report.resumes.copied++;
    } catch (error) {
      report.resumes.failed.push(`${legacyId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function pin(db: ReturnType<MongoClient["db"]>) {
  const setting = await db.collection("careersettings").findOne({ key: "admin" });
  if (!setting?.pinHash) return;
  report.pin = apply ? "copied" : "ready";
  if (apply) await prisma.careerAdminSetting.upsert({ where: { key: "admin" }, create: { key: "admin", pinHash: String(setting.pinHash) }, update: { pinHash: String(setting.pinHash) } });
}

try {
  await mongo.connect();
  const db = mongo.db(process.env.LEGACY_MONGODB_DATABASE!);
  await blogMedia();
  await resumes(db);
  await pin(db);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await mongo.close();
  await prisma.$disconnect();
}
