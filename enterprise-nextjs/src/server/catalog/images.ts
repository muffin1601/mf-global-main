// Product image handling. Parity: backend/utils/productImages.js, but the file
// content (magic bytes) decides the type, never the client MIME or extension.
//
// Storage contract: images live in the PUBLIC bucket `product-images` under
// `product-<uuid>.<ext>`. `Product.imagePath` holds the full PUBLIC URL
// (storage.publicUrl) so any consumer (quotation PDF/HTML) can use it directly:
// `<img src={product.imagePath}>` or fetch(imagePath). Legacy values imported
// from MERN ("/uploads/products/...") are returned untouched by `resolveImageUrl`.
import { randomUUID } from "node:crypto";
import { BUCKETS, storage } from "@/lib/storage";
import { EXTENSION, IMAGE_TYPES, MIME, detectFileType } from "@/lib/files/signature";
import { badRequest } from "@/server/errors";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export type ImageUpload = { bytes: Buffer };

/** Validates and stores an image; returns the public URL to persist in imagePath. */
export async function saveProductImage(file: ImageUpload): Promise<string> {
  if (file.bytes.length === 0) throw badRequest("The uploaded image is empty.");
  if (file.bytes.length > MAX_IMAGE_BYTES) throw badRequest("Product image must be 5 MB or smaller.");
  const type = detectFileType(file.bytes);
  if (!type || !IMAGE_TYPES.has(type)) throw badRequest("The uploaded file content is not a supported image (JPG, PNG, WEBP or GIF).");
  const objectPath = `product-${randomUUID()}.${EXTENSION[type]}`;
  await storage.upload(BUCKETS.productImages, objectPath, file.bytes, MIME[type]);
  return storage.publicUrl(BUCKETS.productImages, objectPath);
}

/** Object path inside the bucket for a URL we stored, or null for legacy/foreign values. */
export function objectPathOf(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  const base = storage.publicUrl(BUCKETS.productImages, "");
  if (!imagePath.startsWith(base)) return null;
  const rest = imagePath.slice(base.length);
  return /^product-[a-zA-Z0-9-]+\.(jpg|png|webp|gif)$/.test(rest) ? rest : null;
}

export async function deleteProductImage(imagePath: string | null | undefined) {
  const objectPath = objectPathOf(imagePath);
  if (objectPath) await storage.remove(BUCKETS.productImages, [objectPath]);
}

export const resolveImageUrl = (imagePath: string | null | undefined) => imagePath ?? null;
