import { randomUUID } from "node:crypto";
import { actorOf, makeUser, prisma } from "./db";
import type { Actor } from "@/server/actor";
import { createVendor } from "@/server/vendors/vendors";
import { addContact, addAddress } from "@/server/vendors/contacts";
import { addActivity } from "@/server/vendors/activities";
import { addEvaluation } from "@/server/vendors/performance";
import { addVendorProduct } from "@/server/vendors/products";
import { uploadDocument } from "@/server/vendors/documents";
import { uploadImport, validateImport } from "@/server/vendors/import-export";

export const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

export async function makeActors() {
  const adminRow = await makeUser({ role: "ADMIN", name: "Admin Person" });
  const userRow = await makeUser({ role: "USER", name: "Normal User" });
  return { admin: actorOf(adminRow), user: actorOf(userRow), adminRow, userRow };
}

let n = 0;
/** Valid GSTIN/PAN pair unique per call (PAN = AAAAA + 4 digits + A, GSTIN embeds it). */
export function ids(seed = ++n) {
  const digits = String(1000 + seed).slice(-4);
  const pan = `AAAAA${digits}A`;
  return { pan, gstin: `27${pan}1Z5` };
}

export async function newVendor(actor: Actor, overrides: Record<string, unknown> = {}) {
  const k = ++n;
  return createVendor(actor, { name: `Vendor Number ${k} ${randomUUID().slice(0, 4)}`, ...overrides });
}

export async function fixtures(actor: Actor) {
  const vendor = await newVendor(actor);
  const archived = await newVendor(actor);
  await prisma.vendor.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
  const contact = await addContact(actor, vendor.id, { name: "Contact One", email: "c1@example.test" });
  const address = await addAddress(actor, vendor.id, { line1: "1 Main Road", postalCode: "560001" });
  const activity = await addActivity(actor, vendor.id, { description: "Called vendor", type: "Call" });
  const category = await prisma.vendorCategory.create({ data: { name: `Cat ${++n}` } });
  const category2 = await prisma.vendorCategory.create({ data: { name: `Cat ${++n}` } });
  const product = await prisma.product.create({ data: { code: `P${++n}`, name: `Widget ${n}` } });
  const item = await addVendorProduct(actor, vendor.id, { productId: product.id, purchasePrice: 10, effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30" });
  const evaluation = await addEvaluation({ ...actor, role: "ADMIN" }, vendor.id, { quality: 4, delivery: 4, leadTime: 4, pricing: 4, responsiveness: 4, compliance: 4 });
  const doc = await uploadDocument(actor, vendor.id, { name: "GST cert", documentType: "GST Certificate" }, { buffer: PDF, name: "gst.pdf" });
  return { vendor, archived, contact, address, activity, category, category2, product, item, evaluation: evaluation.evaluation, doc };
}

export const importCsv = (rows: string[][], header = ["Vendor Name", "Email", "GSTIN", "PAN", "Category", "Status", "Contact Person", "Phone", "City"]) =>
  Buffer.from([header, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n"));

export async function validatedImport(actor: Actor, rows: string[][], key?: string) {
  const up = await uploadImport(actor, { fileName: "vendors.csv", buffer: importCsv(rows), idempotencyKey: key });
  const val = await validateImport(actor, up.jobId);
  return { up, val, jobId: up.jobId };
}
