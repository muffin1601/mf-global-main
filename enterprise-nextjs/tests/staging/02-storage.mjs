// Supabase Storage on staging: bucket existence/privacy, anonymous denial, signed-URL lifecycle.
// Writes ONE synthetic object (qa-staging-check/<uuid>.pdf) into vendor-documents and deletes it at the end.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { guard, reporter, expect } from "./guard.mjs";

guard(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const r = reporter("storage");
const expected = { "career-resumes": false, "vendor-documents": false, "blog-media": null, "product-images": null }; // false = must be private; null = either
const path = `qa-staging-check/${randomUUID()}.pdf`;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

await r.check("all four buckets exist with the required privacy", async () => {
  const { data, error } = await admin.storage.listBuckets();
  if (error) throw error;
  for (const [name, mustBePublic] of Object.entries(expected)) {
    const b = data.find((x) => x.name === name);
    expect(b, `bucket ${name} missing`);
    if (mustBePublic === false) expect(b.public === false, `bucket ${name} is public`);
  }
  return data.map((b) => `${b.name}:${b.public ? "public" : "private"}`).join(", ");
});
await r.check("service role can upload to a private bucket", async () => {
  const { error } = await admin.storage.from("vendor-documents").upload(path, PDF, { contentType: "application/pdf", upsert: false });
  if (error) throw error;
});
await r.check("anonymous client cannot read or list the private object", async () => {
  const dl = await anon.storage.from("vendor-documents").download(path);
  expect(dl.error && !dl.data, "anonymous download succeeded");
  const pub = await fetch(`${url}/storage/v1/object/public/vendor-documents/${path}`);
  expect(pub.status >= 400, "public URL served a private object: " + pub.status);
  const list = await anon.storage.from("vendor-documents").list("qa-staging-check");
  expect(!list.data?.length, "anonymous list returned objects");
});
await r.check("signed URL serves the file and expires", async () => {
  const { data, error } = await admin.storage.from("vendor-documents").createSignedUrl(path, 5);
  if (error) throw error;
  const ok = await fetch(data.signedUrl);
  expect(ok.status === 200 && Buffer.from(await ok.arrayBuffer()).subarray(0, 5).toString() === "%PDF-", "signed URL did not serve the PDF");
  await new Promise((res) => setTimeout(res, 7000));
  const late = await fetch(data.signedUrl);
  expect(late.status >= 400, "signed URL still valid after expiry: " + late.status);
});
await r.check("cleanup: test object removed", async () => {
  const { error } = await admin.storage.from("vendor-documents").remove([path]);
  if (error) throw error;
});
r.done();
