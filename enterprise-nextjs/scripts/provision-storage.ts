// Create / reconcile the Supabase Storage buckets the app expects, with size limits and MIME allow-lists.
//   dry run (default): npx tsx scripts/provision-storage.ts
//   apply:             npx tsx scripts/provision-storage.ts --apply
//   verify (read-only): npx tsx scripts/provision-storage.ts --verify     (exit 1 if any bucket is misconfigured)
// No storage policies are ever created: browsers get NO direct access; every access is brokered by server code.
// Applying to a Supabase project requires ALLOW_PRODUCTION_WRITE=I_HAVE_WRITTEN_APPROVAL (use a staging project).
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { assertSafeWriteTarget } from "./migrate-mongodb/lib";

const MB = 1024 * 1024;
const IMAGES = ["image/jpeg", "image/png", "image/webp"];
export const BUCKET_SPECS = [
  { id: "career-resumes", public: false, fileSizeLimit: 5 * MB, allowedMimeTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  { id: "vendor-documents", public: false, fileSizeLimit: 10 * MB, allowedMimeTypes: ["application/pdf", ...IMAGES, "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] },
  { id: "blog-media", public: true, fileSizeLimit: 5 * MB, allowedMimeTypes: IMAGES },
  { id: "product-images", public: true, fileSizeLimit: 5 * MB, allowedMimeTypes: [...IMAGES, "image/gif"] },
  { id: "user-avatars", public: false, fileSizeLimit: 2 * MB, allowedMimeTypes: IMAGES },
] as const;

const apply = process.argv.includes("--apply");
const verify = process.argv.includes("--verify");
const need = (name: string) => { const v = process.env[name]; if (!v) throw new Error(`Missing required environment variable name: ${name}`); return v; };

async function main() {
  const url = need("NEXT_PUBLIC_SUPABASE_URL");
  if (apply) assertSafeWriteTarget(url);
  const supabase = createClient(url, need("SUPABASE_SECRET_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: existing, error } = await supabase.storage.listBuckets();
  if (error) throw new Error("listBuckets failed");
  const byId = new Map(existing.map((b) => [b.id, b]));
  let bad = 0;
  for (const spec of BUCKET_SPECS) {
    const current = byId.get(spec.id);
    const sameMimes = current && JSON.stringify([...(current.allowed_mime_types ?? [])].sort()) === JSON.stringify([...spec.allowedMimeTypes].sort());
    const ok = !!current && current.public === spec.public && current.file_size_limit === spec.fileSizeLimit && sameMimes;
    console.log(`${ok ? "OK     " : current ? "DRIFT  " : "MISSING"} ${spec.id} (${spec.public ? "public" : "PRIVATE"}, <=${spec.fileSizeLimit / MB}MB)`);
    if (ok) continue;
    bad++;
    if (!apply) continue;
    const options = { public: spec.public, fileSizeLimit: spec.fileSizeLimit, allowedMimeTypes: [...spec.allowedMimeTypes] };
    const result = current ? await supabase.storage.updateBucket(spec.id, options) : await supabase.storage.createBucket(spec.id, options);
    if (result.error) throw new Error(`could not configure bucket ${spec.id}`);
    console.log(`  -> ${current ? "updated" : "created"} ${spec.id}`);
  }
  if (verify && bad) process.exitCode = 1;
  console.log(apply ? "applied." : verify ? (bad ? "verification FAILED" : "verification passed") : `dry run: ${bad} bucket(s) need changes (re-run with --apply)`);
}
main().catch((e) => { console.error("provision-storage failed:", String(e?.message ?? e)); process.exit(2); });
