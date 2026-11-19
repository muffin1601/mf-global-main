// Copies product images from the legacy Express upload folder into the public Supabase
// bucket `product-images` and rewrites products.p_image to the public URL.
//   dry run: npx tsx scripts/migrate-mongodb/product-images.ts
//   apply:   npx tsx scripts/migrate-mongodb/product-images.ts --apply
// Idempotent: files are upserted by name and already-migrated URLs are skipped.
// Env: LEGACY_UPLOADS_DIR (default ../backend/uploads/products).
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { assertSafeWriteTarget } from "./lib";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY, db = process.env.DATABASE_URL;
if (!url || !key || !db) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY or DATABASE_URL");
if (apply) assertSafeWriteTarget(url);
const dir = resolve(process.env.LEGACY_UPLOADS_DIR ?? "../backend/uploads/products");
const BUCKET = "product-images";
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: db }) });

async function main() {
  const products = await prisma.product.findMany({ where: { imagePath: { not: null } }, select: { id: true, code: true, imagePath: true } });
  const r = { withImage: products.length, alreadyMigrated: 0, uploaded: 0, missingFile: [] as string[], unsupported: [] as string[], failed: [] as string[] };
  for (const p of products) {
    const ref = p.imagePath!;
    if (ref.startsWith(`${url}/storage/v1/object/public/${BUCKET}/`)) { r.alreadyMigrated++; continue; }
    const name = basename(ref.split("?")[0]!);
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (!ref.startsWith("/uploads/products/") || !MIME[ext] || !/^product-[a-zA-Z0-9-]+\.(jpe?g|png|webp|gif)$/i.test(name)) { r.unsupported.push(`${p.code}: ${ref}`); continue; }
    let bytes: Buffer;
    try { bytes = await readFile(resolve(dir, name)); } catch { r.missingFile.push(`${p.code}: ${name}`); continue; }
    if (!apply) { r.uploaded++; continue; }
    try {
      const up = await supabase.storage.from(BUCKET).upload(name, bytes, { contentType: MIME[ext], upsert: true, cacheControl: "31536000" });
      if (up.error) throw new Error(up.error.message);
      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
      await prisma.product.update({ where: { id: p.id }, data: { imagePath: publicUrl } });
      r.uploaded++;
      console.log(`  ${r.uploaded}: ${name}`);
    } catch (e) { r.failed.push(`${p.code}: ${name}: ${String((e as Error).message)}`); }
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...r }, null, 2));
  if (r.failed.length) process.exitCode = 1;
}
main().catch((e) => { console.error("product-images failed:", String(e?.message ?? e)); process.exit(2); }).finally(() => prisma.$disconnect());
