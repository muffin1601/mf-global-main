import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BUCKETS, setStorageDriverForTests } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { archiveVendor, deleteVendor } from "@/server/vendors/vendors";
import { MAX_DOCUMENT_BYTES, deleteDocument, documentSignedUrl, listDocuments, readDocument, replaceDocumentFile, updateDocument, uploadDocument } from "@/server/vendors/documents";
import { prisma, resetDb } from "./helpers/db";
import { createMemoryStorage } from "./helpers/storage";
import { PDF, PNG, makeActors, newVendor } from "./helpers/vendor-fixtures";

const mem = createMemoryStorage();
let admin: Actor, user: Actor;
beforeAll(() => setStorageDriverForTests(mem));
afterAll(() => setStorageDriverForTests(null));
beforeEach(async () => {
  await resetDb();
  mem.files.clear();
  ({ admin, user } = await makeActors());
});

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString();

describe("document upload validation (magic bytes, never client MIME/extension)", () => {
  it("accepts pdf and image, stores them in the private bucket under the vendor", async () => {
    const v = await newVendor(admin);
    const d = await uploadDocument(user, v.id, { name: "GST", documentType: "GST Certificate" }, { buffer: PDF, name: "gst.pdf" });
    const img = await uploadDocument(user, v.id, { name: "Photo" }, { buffer: PNG, name: "p.png" });
    expect(d).toMatchObject({ mimeType: "application/pdf", sizeBytes: PDF.length, uploadedByName: user.name, expiryState: "none", canPreview: true });
    expect(img.mimeType).toBe("image/png");
    expect(d).not.toHaveProperty("storagePath");
    const row = await prisma.vendorDocument.findUniqueOrThrow({ where: { id: d.id } });
    expect(row.storagePath.startsWith(`${v.id}/`)).toBe(true);
    expect(mem.files.has(`${BUCKETS.vendorDocuments}/${row.storagePath}`)).toBe(true);
  });

  it("rejects disguised files, wrong extensions, oversize, empty and gif", async () => {
    const v = await newVendor(admin);
    const up = (buffer: Buffer, name: string) => uploadDocument(admin, v.id, { name: "X" }, { buffer, name });
    await expect(up(Buffer.from("<html><script>alert(1)</script></html>"), "evil.pdf")).rejects.toMatchObject({ status: 415 });
    await expect(up(Buffer.from("MZ\x90\x00fake exe"), "setup.exe")).rejects.toMatchObject({ status: 415 });
    await expect(up(PDF, "doc.png")).rejects.toMatchObject({ status: 415 }); // extension does not match contents
    await expect(up(Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(20)]), "a.gif")).rejects.toMatchObject({ status: 415 });
    await expect(up(Buffer.concat([PDF, Buffer.alloc(MAX_DOCUMENT_BYTES)]), "big.pdf")).rejects.toMatchObject({ status: 413 });
    await expect(up(Buffer.alloc(0), "empty.pdf")).rejects.toMatchObject({ status: 400 });
    await expect(uploadDocument(admin, v.id, { name: "X" }, null)).rejects.toMatchObject({ status: 400 });
    await expect(uploadDocument(admin, v.id, { name: "" }, { buffer: PDF, name: "a.pdf" })).rejects.toThrow(/name is required/);
    await expect(uploadDocument(admin, v.id, { name: "X", issueDate: "2026-05-01", expiryDate: "2026-04-01" }, { buffer: PDF, name: "a.pdf" })).rejects.toThrow(/after the issue date/);
    expect(mem.files.size).toBe(0);
    expect(await prisma.vendorDocument.count()).toBe(0);
  });
});

describe("expiry state", () => {
  it("derives expired / expiring (<=30d) / valid / none", async () => {
    const v = await newVendor(admin);
    const mk = (name: string, expiryDate?: string) => uploadDocument(admin, v.id, { name, expiryDate }, { buffer: PDF, name: "a.pdf" });
    await mk("expired", day(-3));
    await mk("soon", day(10));
    await mk("edge", day(29.5));
    await mk("fine", day(120));
    await mk("never");
    const states = Object.fromEntries((await listDocuments(user, v.id)).documents.map((d) => [d.name, d.expiryState]));
    expect(states).toEqual({ expired: "expired", soon: "expiring", edge: "expiring", fine: "valid", never: "none" });
  });
});

describe("authorised access: signed URL and streamed download", () => {
  it("issues a short-lived signed URL only to authorised callers for the owning vendor", async () => {
    const v = await newVendor(admin);
    const w = await newVendor(admin);
    const d = await uploadDocument(admin, v.id, { name: "Secret" }, { buffer: PDF, name: "s.pdf" });
    const signed = await documentSignedUrl(user, v.id, d.id);
    expect(signed.url).toContain("memory://signed/vendor-documents/");
    expect(signed.expiresInSec).toBeLessThanOrEqual(300);
    await expect(documentSignedUrl(null, v.id, d.id)).rejects.toMatchObject({ status: 401 });
    await expect(readDocument(null, v.id, d.id)).rejects.toMatchObject({ status: 401 });
    await expect(documentSignedUrl(user, w.id, d.id)).rejects.toMatchObject({ status: 404 }); // document id under the wrong vendor
    await expect(readDocument(user, w.id, d.id)).rejects.toMatchObject({ status: 404 });
    const read = await readDocument(user, v.id, d.id, { inline: true });
    expect(read.body.equals(PDF)).toBe(true);
    expect(read).toMatchObject({ mimeType: "application/pdf", inline: true, fileName: "s.pdf" });
    expect(await prisma.activityLog.count({ where: { action: "vendor.document_accessed" } })).toBe(1);
  });

  it("never previews inline for non-viewable types; the bucket is the private one", async () => {
    const v = await newVendor(admin);
    const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("word/document.xml")]);
    const d = await uploadDocument(admin, v.id, { name: "Word" }, { buffer: docx, name: "w.docx" });
    expect((await readDocument(admin, v.id, d.id, { inline: true })).inline).toBe(false);
    for (const key of mem.files.keys()) expect(key.startsWith("vendor-documents/")).toBe(true);
  });
});

describe("replace, edit, delete", () => {
  it("replaces the file (old object removed after the new one is recorded), edits metadata, deletes", async () => {
    const v = await newVendor(admin);
    const d = await uploadDocument(user, v.id, { name: "Cert" }, { buffer: PDF, name: "cert.pdf" });
    const before = (await prisma.vendorDocument.findUniqueOrThrow({ where: { id: d.id } })).storagePath;
    await expect(replaceDocumentFile(user, v.id, d.id, { buffer: Buffer.from("not a file"), name: "x.pdf" })).rejects.toMatchObject({ status: 415 });
    expect(mem.files.has(`${BUCKETS.vendorDocuments}/${before}`)).toBe(true);
    const r = await replaceDocumentFile(user, v.id, d.id, { buffer: PNG, name: "scan.png" });
    expect(r).toMatchObject({ mimeType: "image/png", originalName: "scan.png" });
    const after = (await prisma.vendorDocument.findUniqueOrThrow({ where: { id: d.id } })).storagePath;
    expect(after).not.toBe(before);
    expect(mem.files.has(`${BUCKETS.vendorDocuments}/${before}`)).toBe(false);
    expect(mem.files.has(`${BUCKETS.vendorDocuments}/${after}`)).toBe(true);

    expect(await updateDocument(user, v.id, d.id, { name: "Renamed", expiryDate: day(400), status: "ARCHIVED" })).toMatchObject({ name: "Renamed", status: "ARCHIVED" });
    expect((await listDocuments(user, v.id)).total).toBe(0);
    expect((await listDocuments(user, v.id, { status: "ARCHIVED" })).total).toBe(1);

    await deleteDocument(user, v.id, d.id);
    expect(mem.files.size).toBe(0);
    expect(await prisma.vendorDocument.count()).toBe(0);
  });

  it("permanent vendor delete also removes the stored files", async () => {
    const v = await newVendor(admin);
    await uploadDocument(admin, v.id, { name: "A" }, { buffer: PDF, name: "a.pdf" });
    await uploadDocument(admin, v.id, { name: "B" }, { buffer: PNG, name: "b.png" });
    expect(mem.files.size).toBe(2);
    await archiveVendor(admin, v.id);
    await deleteVendor(admin, v.id, v.vendorCode);
    expect(mem.files.size).toBe(0);
    expect(await prisma.vendorDocument.count()).toBe(0);
  });
});
