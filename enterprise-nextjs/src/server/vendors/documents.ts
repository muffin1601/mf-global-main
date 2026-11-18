import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma/client";
import { BUCKETS, storage } from "@/lib/storage";
import { detectFileType, type DetectedFile } from "@/lib/files/signature";
import { HttpError, badRequest, notFound } from "@/server/errors";
import { audit, authorize, failIf, loadVendor, pageParams, requireId, type MaybeActor } from "./common";
import { expiryState, has, parseDate, validateDocumentPayload, type Input } from "./fields";

/**
 * MERN allowed 10 MB. Vercel Functions reject request bodies above 4.5 MB, so the
 * server-upload limit is 4 MB here (documented deviation; larger files would need
 * direct-to-storage signed uploads).
 */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const SIGNED_URL_TTL_SEC = 120;
const INLINE: ReadonlySet<string> = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

const EXT_FOR: Partial<Record<DetectedFile, string[]>> = {
  pdf: ["pdf"], jpeg: ["jpg", "jpeg"], png: ["png"], webp: ["webp"], doc: ["doc", "xls"], docx: ["docx"], xlsx: ["xlsx"],
};
const MIME_FOR: Partial<Record<DetectedFile, string>> = {
  pdf: "application/pdf", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export type UploadFile = { buffer: Buffer; name: string };

/** Magic-byte validation: client MIME and extension are never trusted. */
export function validateUpload(file: UploadFile | null | undefined) {
  if (!file || !file.buffer?.length) throw badRequest("Select a file to upload");
  if (file.buffer.length > MAX_DOCUMENT_BYTES) throw new HttpError(413, `File is too large. The maximum size is ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.`, "TOO_LARGE");
  const type = detectFileType(file.buffer);
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const allowed = type ? EXT_FOR[type] : undefined;
  if (!type || !allowed) throw new HttpError(415, "Unsupported file type. Allowed: pdf, jpg, png, webp, doc, docx, xls, xlsx", "UNSUPPORTED_TYPE");
  if (!allowed.includes(ext)) throw new HttpError(415, "The file extension does not match the file contents", "UNSUPPORTED_TYPE");
  const mime = type === "doc" && ext === "xls" ? "application/vnd.ms-excel" : (MIME_FOR[type] as string);
  return { ext, mime };
}

type DocRow = Awaited<ReturnType<typeof prisma.vendorDocument.findFirstOrThrow>>;
function present(d: DocRow, now = new Date()) {
  const { state, days } = expiryState(d.expiryDate, now);
  const { storagePath, ...rest } = d; // storage path is internal; clients use the authorised download route
  void storagePath;
  return { ...rest, expiryState: state, daysToExpiry: days, canPreview: INLINE.has(d.mimeType) };
}

export async function listDocuments(actor: MaybeActor, vendorId: string, query: { status?: string; page?: unknown; limit?: unknown } = {}) {
  authorize(actor, "vendor.view");
  const v = await loadVendor(vendorId);
  const { page, limit, skip } = pageParams(query, 100);
  const where = { vendorId: v.id, status: query.status === "ARCHIVED" || query.status === "Archived" ? ("ARCHIVED" as const) : ("ACTIVE" as const) };
  const [rows, total] = await Promise.all([
    prisma.vendorDocument.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.vendorDocument.count({ where }),
  ]);
  const now = new Date();
  return { documents: rows.map((d) => present(d, now)), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function uploadDocument(actor: MaybeActor, vendorId: string, input: Input, file: UploadFile | null | undefined) {
  const a = authorize(actor, "vendor.documents");
  const v = await loadVendor(vendorId);
  failIf(validateDocumentPayload(input));
  const { ext, mime } = validateUpload(file);
  const f = file as UploadFile;
  const path = `${v.id}/${randomUUID()}.${ext}`;
  await storage.upload(BUCKETS.vendorDocuments, path, f.buffer, mime);
  try {
    return await prisma.$transaction(async (tx) => {
      const d = await tx.vendorDocument.create({
        data: {
          vendorId: v.id, name: String(input.name).trim(), documentType: has(input.documentType) ? String(input.documentType) : "Other",
          description: String(input.description ?? "").trim(), storagePath: path, originalName: f.name.replace(/["\r\n\\/]/g, "_").slice(0, 200),
          mimeType: mime, sizeBytes: f.buffer.length, issueDate: parseDate(input.issueDate), expiryDate: parseDate(input.expiryDate),
          uploadedById: a.id, uploadedByName: a.name,
        },
      });
      await audit(tx, a, "vendor.document_uploaded", v, { document: d.name, documentType: d.documentType });
      return present(d);
    });
  } catch (e) {
    await storage.remove(BUCKETS.vendorDocuments, [path]).catch(() => undefined);
    throw e;
  }
}

async function ownDocument(vendorId: string, docId: string) {
  const v = await loadVendor(vendorId);
  const d = await prisma.vendorDocument.findUnique({ where: { id: requireId(docId, "document") } });
  if (!d || d.vendorId !== v.id) throw notFound("Document not found for this vendor");
  return { v, d };
}

export async function replaceDocumentFile(actor: MaybeActor, vendorId: string, docId: string, file: UploadFile | null | undefined) {
  const a = authorize(actor, "vendor.documents");
  const { v, d } = await ownDocument(vendorId, docId);
  const { ext, mime } = validateUpload(file);
  const f = file as UploadFile;
  const path = `${v.id}/${randomUUID()}.${ext}`;
  await storage.upload(BUCKETS.vendorDocuments, path, f.buffer, mime);
  try {
    const u = await prisma.$transaction(async (tx) => {
      const row = await tx.vendorDocument.update({
        where: { id: d.id },
        data: { storagePath: path, originalName: f.name.replace(/["\r\n\\/]/g, "_").slice(0, 200), mimeType: mime, sizeBytes: f.buffer.length, uploadedById: a.id, uploadedByName: a.name },
      });
      await audit(tx, a, "vendor.document_replaced", v, { document: d.name });
      return row;
    });
    await storage.remove(BUCKETS.vendorDocuments, [d.storagePath]).catch(() => undefined); // only after the new file is recorded
    return present(u);
  } catch (e) {
    await storage.remove(BUCKETS.vendorDocuments, [path]).catch(() => undefined);
    throw e;
  }
}

export async function updateDocument(actor: MaybeActor, vendorId: string, docId: string, input: Input) {
  const a = authorize(actor, "vendor.documents");
  const { v, d } = await ownDocument(vendorId, docId);
  failIf(validateDocumentPayload({ ...d, ...input }));
  const status = input.status === "ARCHIVED" || input.status === "Archived" ? "ARCHIVED" : input.status === "ACTIVE" || input.status === "Active" ? "ACTIVE" : undefined;
  const u = await prisma.$transaction(async (tx) => {
    const row = await tx.vendorDocument.update({
      where: { id: d.id },
      data: {
        ...(has(input.name) ? { name: String(input.name).trim() } : {}),
        ...(has(input.documentType) ? { documentType: String(input.documentType) } : {}),
        ...("description" in input ? { description: String(input.description ?? "").trim() } : {}),
        ...("issueDate" in input ? { issueDate: parseDate(input.issueDate) } : {}),
        ...("expiryDate" in input ? { expiryDate: parseDate(input.expiryDate) } : {}),
        ...(status ? { status } : {}),
      },
    });
    await audit(tx, a, "vendor.document_updated", v, { document: row.name });
    return row;
  });
  return present(u);
}

export async function deleteDocument(actor: MaybeActor, vendorId: string, docId: string) {
  const a = authorize(actor, "vendor.documents");
  const { v, d } = await ownDocument(vendorId, docId);
  await prisma.$transaction(async (tx) => {
    await tx.vendorDocument.delete({ where: { id: d.id } });
    await audit(tx, a, "vendor.document_deleted", v, { document: d.name });
  });
  await storage.remove(BUCKETS.vendorDocuments, [d.storagePath]).catch(() => undefined);
  return { ok: true as const };
}

/** Short-lived signed URL, issued only after the caller is authorised for this vendor's documents. */
export async function documentSignedUrl(actor: MaybeActor, vendorId: string, docId: string, opts: { inline?: boolean } = {}) {
  const a = authorize(actor, "vendor.view");
  const { v, d } = await ownDocument(vendorId, docId);
  const url = await storage.signedUrl(BUCKETS.vendorDocuments, d.storagePath, SIGNED_URL_TTL_SEC);
  if (!url) throw notFound("The stored file is no longer available");
  await audit(prisma, a, "vendor.document_accessed", v, { document: d.name });
  return { url, expiresInSec: SIGNED_URL_TTL_SEC, fileName: d.originalName, inline: !!opts.inline && INLINE.has(d.mimeType) };
}

/** Server-streamed download/preview (authorised first). Used by the route handler. */
export async function readDocument(actor: MaybeActor, vendorId: string, docId: string, opts: { inline?: boolean } = {}) {
  authorize(actor, "vendor.view");
  const { d } = await ownDocument(vendorId, docId);
  const body = await storage.download(BUCKETS.vendorDocuments, d.storagePath);
  if (!body) throw notFound("The stored file is no longer available");
  return { body, mimeType: d.mimeType || "application/octet-stream", fileName: d.originalName, inline: !!opts.inline && INLINE.has(d.mimeType) };
}
