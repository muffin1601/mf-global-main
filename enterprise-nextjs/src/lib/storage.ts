import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Buckets (created by scripts/provision-storage.mjs, never by app code):
 *   career-resumes   private   resumes (signed/server-streamed downloads only)
 *   vendor-documents private   vendor compliance documents
 *   blog-media       public    blog images
 *   product-images   public    catalogue photos
 * Browser clients get NO storage policies; every access goes through server code
 * that has already authorised the caller.
 */
export const BUCKETS = {
  resumes: "career-resumes",
  vendorDocuments: "vendor-documents",
  blogMedia: "blog-media",
  productImages: "product-images",
} as const;

export interface StorageDriver {
  upload(bucket: string, path: string, body: Buffer, contentType: string): Promise<void>;
  download(bucket: string, path: string): Promise<Buffer | null>;
  remove(bucket: string, paths: string[]): Promise<void>;
  signedUrl(bucket: string, path: string, expiresInSec: number): Promise<string | null>;
  publicUrl(bucket: string, path: string): string;
}

const supabaseDriver: StorageDriver = {
  async upload(bucket, path, body, contentType) {
    const { error } = await createSupabaseAdminClient().storage.from(bucket).upload(path, body, { contentType, upsert: false });
    if (error) throw new Error(`storage upload failed (${bucket})`);
  },
  async download(bucket, path) {
    const { data, error } = await createSupabaseAdminClient().storage.from(bucket).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  },
  async remove(bucket, paths) {
    if (paths.length) await createSupabaseAdminClient().storage.from(bucket).remove(paths);
  },
  async signedUrl(bucket, path, expiresInSec) {
    const { data, error } = await createSupabaseAdminClient().storage.from(bucket).createSignedUrl(path, expiresInSec);
    return error || !data ? null : data.signedUrl;
  },
  publicUrl(bucket, path) {
    return createSupabaseAdminClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },
};

let override: StorageDriver | null = null;
/** Tests inject an in-memory driver (see tests/helpers/storage.ts). Pass null to restore. */
export function setStorageDriverForTests(driver: StorageDriver | null) { override = driver; }

export const storage: StorageDriver = {
  upload: (...a) => (override ?? supabaseDriver).upload(...a),
  download: (...a) => (override ?? supabaseDriver).download(...a),
  remove: (...a) => (override ?? supabaseDriver).remove(...a),
  signedUrl: (...a) => (override ?? supabaseDriver).signedUrl(...a),
  publicUrl: (...a) => (override ?? supabaseDriver).publicUrl(...a),
};
