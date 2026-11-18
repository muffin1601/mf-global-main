import type { StorageDriver } from "@/lib/storage";

/** In-memory storage driver for tests. Call `setStorageDriverForTests(createMemoryStorage())`. */
export function createMemoryStorage() {
  const files = new Map<string, { body: Buffer; contentType: string }>();
  const k = (bucket: string, path: string) => `${bucket}/${path}`;
  const driver: StorageDriver = {
    async upload(bucket, path, body, contentType) {
      if (files.has(k(bucket, path))) throw new Error("exists");
      files.set(k(bucket, path), { body, contentType });
    },
    async download(bucket, path) { return files.get(k(bucket, path))?.body ?? null; },
    async remove(bucket, paths) { for (const p of paths) files.delete(k(bucket, p)); },
    async signedUrl(bucket, path) { return files.has(k(bucket, path)) ? `memory://signed/${bucket}/${path}` : null; },
    publicUrl(bucket, path) { return `memory://public/${bucket}/${path}`; },
  };
  return Object.assign(driver, { files });
}
