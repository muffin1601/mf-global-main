"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { HttpError } from "@/server/errors";
import type { Actor } from "@/server/actor";
import type { Input } from "@/server/vendors/fields";
import { DuplicateError, archiveVendor, bulkArchive, bulkSetStatus, checkDuplicates, createVendor, deleteVendor, restoreVendor, setVendorStatus, updateVendor } from "@/server/vendors/vendors";
import { addAddress, addContact, deleteAddress, deleteContact, setPrimaryAddress, setPrimaryContact, updateAddress, updateContact } from "@/server/vendors/contacts";
import { addVendorProduct, deleteVendorProduct, updateVendorProduct } from "@/server/vendors/products";
import { addActivity, deleteActivity, updateActivity } from "@/server/vendors/activities";
import { addEvaluation, deleteEvaluation } from "@/server/vendors/performance";
import { deleteDocument, updateDocument } from "@/server/vendors/documents";
import { createCategory, deleteCategory, updateCategory } from "@/server/vendors/categories";
import { commitImport, validateImport } from "@/server/vendors/import-export";

export type ActionResult<T = Record<string, unknown>> =
  | ({ ok: true; message?: string; redirect?: string } & T)
  | { ok: false; error: string; duplicates?: DuplicateView[]; blocking?: boolean };
export type DuplicateView = { id: string; vendorCode: string; name: string; status: string; archived: boolean; reason: string };

async function actor(): Promise<Actor> {
  const u = await requireUser();
  return { id: u.id, role: u.role, name: u.name, userId: u.userId, email: u.email };
}

async function run<T extends Record<string, unknown>>(fn: (a: Actor) => Promise<T>, paths: string[] = []): Promise<ActionResult<T>> {
  try {
    const result = await fn(await actor());
    for (const p of paths) revalidatePath(p);
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof DuplicateError) return { ok: false, error: e.message, duplicates: e.duplicates, blocking: e.blocking };
    if (e instanceof HttpError) return { ok: false, error: e.message };
    // Expected failures only; anything else is logged without payloads (no bank data) and shown generically.
    console.error("vendor action failed", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const str = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
const flag = (v: string | undefined) => v === "on" || v === "true";
const LIST = "/crm/vendors";
const profile = (id: string) => `/crm/vendors/${id}`;

/* ------------------------------------------------------------------ vendors */
function vendorInput(f: Record<string, string>, opts: { create: boolean; bank: boolean }): Input {
  const input: Input = {};
  for (const k of ["name", "legalName", "email", "phone", "website", "gstin", "pan", "cin", "taxRegistration", "vendorType", "industry", "description", "notes", "priority", "categoryId", "ownerId"]) {
    if (k in f) input[k] = f[k];
  }
  if (opts.create && f.status) input.status = f.status;
  if ("tags" in f) input.tags = f.tags.split(",").map((t) => t.trim()).filter(Boolean);
  if (f.updatedAt) input.updatedAt = f.updatedAt;
  if (f.confirmDuplicate === "true") input.confirmDuplicate = true;
  if (opts.bank) {
    const bank: Input = {};
    for (const [k, v] of Object.entries(f)) if (k.startsWith("bank_")) bank[k.slice(5)] = v;
    if (Object.keys(bank).length) input.bank = bank;
  }
  if (opts.create) {
    if (f.contactName) input.contacts = [{ name: f.contactName, email: f.contactEmail, phone: f.contactPhone, designation: f.contactDesignation, isPrimary: true }];
    if (f.line1) input.addresses = [{ type: f.addressType || "Registered Office", line1: f.line1, line2: f.line2, city: f.city, state: f.state, postalCode: f.postalCode, country: f.country || "India", isPrimary: true }];
  }
  return input;
}

export async function createVendorAction(fd: FormData) {
  return run(async (a) => {
    const v = await createVendor(a, vendorInput(str(fd), { create: true, bank: true }));
    return { id: v.id, message: `Vendor ${v.vendorCode} created`, redirect: profile(v.id) };
  }, [LIST]);
}
export async function updateVendorAction(id: string, fd: FormData) {
  return run(async (a) => {
    const r = await updateVendor(a, id, vendorInput(str(fd), { create: false, bank: true }));
    return { message: r.changed.length ? "Vendor updated" : "No changes" };
  }, [LIST, profile(id)]);
}
export async function checkDuplicatesAction(candidate: Record<string, string>) {
  return run(async (a) => {
    const r = await checkDuplicates(a, candidate);
    return { blocking: r.blocking as unknown as DuplicateView[], warnings: r.warnings as unknown as DuplicateView[] };
  });
}
export async function setStatusAction(id: string, status: string) {
  return run(async (a) => ({ message: (await setVendorStatus(a, id, status)).unchanged ? "Status unchanged" : "Status updated" }), [LIST, profile(id)]);
}
export async function changeStatusAction(id: string, fd: FormData) {
  return run(async (a) => { const r = await setVendorStatus(a, id, fd.get("status"), String(fd.get("reason") ?? "")); return { message: r.unchanged ? "Status unchanged" : "Status updated" }; }, [LIST, profile(id)]);
}
export async function bulkStatusAction(ids: string[], status: string) {
  return run(async (a) => { const r = await bulkSetStatus(a, ids, status); return { message: `${r.updated} vendor(s) updated` }; }, [LIST]);
}
export async function archiveAction(id: string, _fd?: FormData) {
  void _fd;
  return run(async (a) => { await archiveVendor(a, id); return { message: "Vendor archived" }; }, [LIST, profile(id)]);
}
export async function restoreAction(id: string, _fd?: FormData) {
  void _fd;
  return run(async (a) => { await restoreVendor(a, id); return { message: "Vendor restored" }; }, [LIST, profile(id)]);
}
export async function bulkArchiveAction(ids: string[], restore: boolean) {
  return run(async (a) => { const r = await bulkArchive(a, ids, restore); return { message: `${r.updated} vendor(s) ${restore ? "restored" : "archived"}` }; }, [LIST]);
}
export async function deleteVendorAction(id: string, fd: FormData) {
  return run(async (a) => { await deleteVendor(a, id, fd.get("confirmCode")); return { message: "Vendor permanently deleted", redirect: LIST }; }, [LIST]);
}

/* ---------------------------------------------------------- contacts / addresses */
const contactIn = (f: Record<string, string>): Input => ({ name: f.name, designation: f.designation, email: f.email, phone: f.phone, isPrimary: flag(f.isPrimary) });
const addressIn = (f: Record<string, string>): Input => ({ type: f.type, line1: f.line1, line2: f.line2, city: f.city, state: f.state, postalCode: f.postalCode, country: f.country, isPrimary: flag(f.isPrimary) });

export async function addContactAction(vid: string, fd: FormData) { return run(async (a) => { await addContact(a, vid, contactIn(str(fd))); return { message: "Contact added" }; }, [profile(vid)]); }
export async function updateContactAction(vid: string, id: string, fd: FormData) { return run(async (a) => { await updateContact(a, vid, id, contactIn(str(fd))); return { message: "Contact updated" }; }, [profile(vid)]); }
export async function primaryContactAction(vid: string, id: string) { return run(async (a) => { await setPrimaryContact(a, vid, id); return { message: "Primary contact set" }; }, [profile(vid)]); }
export async function deleteContactAction(vid: string, id: string) { return run(async (a) => { await deleteContact(a, vid, id); return { message: "Contact deleted" }; }, [profile(vid)]); }
export async function addAddressAction(vid: string, fd: FormData) { return run(async (a) => { await addAddress(a, vid, addressIn(str(fd))); return { message: "Address added" }; }, [profile(vid)]); }
export async function updateAddressAction(vid: string, id: string, fd: FormData) { return run(async (a) => { await updateAddress(a, vid, id, addressIn(str(fd))); return { message: "Address updated" }; }, [profile(vid)]); }
export async function primaryAddressAction(vid: string, id: string) { return run(async (a) => { await setPrimaryAddress(a, vid, id); return { message: "Primary address set" }; }, [profile(vid)]); }
export async function deleteAddressAction(vid: string, id: string) { return run(async (a) => { await deleteAddress(a, vid, id); return { message: "Address deleted" }; }, [profile(vid)]); }

/* ------------------------------------------------------------------ products */
function productIn(f: Record<string, string>): Input {
  const tiers: Input[] = [];
  for (let i = 1; i <= 3; i += 1) {
    if (f[`tier${i}_minQty`] || f[`tier${i}_unitPrice`]) tiers.push({ minQty: f[`tier${i}_minQty`], maxQty: f[`tier${i}_maxQty`], unitPrice: f[`tier${i}_unitPrice`], discountPercent: f[`tier${i}_discountPercent`] });
  }
  return {
    productId: f.productId, vendorItemCode: f.vendorItemCode, purchasePrice: f.purchasePrice, currency: f.currency, moq: f.moq, leadTimeDays: f.leadTimeDays,
    taxRate: f.taxRate, discountPercent: f.discountPercent, effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo || null, notes: f.notes,
    isActive: flag(f.isActive), isPreferred: flag(f.isPreferred), priceTiers: tiers,
  };
}
export async function addProductAction(vid: string, fd: FormData) { return run(async (a) => { await addVendorProduct(a, vid, productIn(str(fd))); return { message: "Pricing record added" }; }, [profile(vid)]); }
export async function updateProductAction(vid: string, id: string, fd: FormData) {
  return run(async (a) => { const { productId: _p, ...rest } = productIn(str(fd)); void _p; await updateVendorProduct(a, vid, id, rest); return { message: "Pricing record updated" }; }, [profile(vid)]);
}
export async function deleteProductAction(vid: string, id: string) { return run(async (a) => { await deleteVendorProduct(a, vid, id); return { message: "Pricing record removed" }; }, [profile(vid)]); }

/* ---------------------------------------------------------------- activities */
const activityIn = (f: Record<string, string>): Input => ({ type: f.type, subject: f.subject, description: f.description, occurredAt: f.occurredAt || undefined });
export async function addActivityAction(vid: string, fd: FormData) { return run(async (a) => { await addActivity(a, vid, activityIn(str(fd))); return { message: "Activity added" }; }, [profile(vid)]); }
export async function updateActivityAction(vid: string, id: string, fd: FormData) { return run(async (a) => { await updateActivity(a, vid, id, activityIn(str(fd))); return { message: "Activity updated" }; }, [profile(vid)]); }
export async function deleteActivityAction(vid: string, id: string) { return run(async (a) => { await deleteActivity(a, vid, id); return { message: "Activity deleted" }; }, [profile(vid)]); }

/* --------------------------------------------------------------- evaluations */
export async function addEvaluationAction(vid: string, fd: FormData) {
  return run(async (a) => { await addEvaluation(a, vid, str(fd)); return { message: "Evaluation recorded" }; }, [profile(vid), `${LIST}/performance`]);
}
export async function deleteEvaluationAction(vid: string, id: string) {
  return run(async (a) => { await deleteEvaluation(a, vid, id); return { message: "Evaluation deleted" }; }, [profile(vid), `${LIST}/performance`]);
}

/* ----------------------------------------------------------------- documents */
export async function updateDocumentAction(vid: string, id: string, fd: FormData) {
  return run(async (a) => { const f = str(fd); await updateDocument(a, vid, id, { name: f.name, documentType: f.documentType, description: f.description, issueDate: f.issueDate || null, expiryDate: f.expiryDate || null }); return { message: "Document updated" }; }, [profile(vid)]);
}
export async function archiveDocumentAction(vid: string, id: string, status: "ARCHIVED" | "ACTIVE") {
  return run(async (a) => { await updateDocument(a, vid, id, { status }); return { message: status === "ARCHIVED" ? "Document archived" : "Document restored" }; }, [profile(vid)]);
}
export async function deleteDocumentAction(vid: string, id: string) { return run(async (a) => { await deleteDocument(a, vid, id); return { message: "Document deleted" }; }, [profile(vid)]); }

/* ---------------------------------------------------------------- categories */
export async function createCategoryAction(fd: FormData) { return run(async (a) => { const f = str(fd); await createCategory(a, { name: f.name, description: f.description }); return { message: "Category created" }; }, [`${LIST}/categories`]); }
export async function updateCategoryAction(id: string, fd: FormData) {
  return run(async (a) => { const f = str(fd); await updateCategory(a, id, { name: f.name, description: f.description, isActive: flag(f.isActive) }); return { message: "Category updated" }; }, [`${LIST}/categories`]);
}
export async function deleteCategoryAction(id: string, fd: FormData) {
  return run(async (a) => { const r = await deleteCategory(a, id, str(fd).reassignTo); return { message: r.vendorsReassigned ? `Category deleted; ${r.vendorsReassigned} vendor(s) moved` : "Category deleted" }; }, [`${LIST}/categories`, LIST]);
}

/* -------------------------------------------------------------------- import */
export async function validateImportAction(jobId: string, mapping: Record<string, string>) {
  return run(async (a) => ({ ...(await validateImport(a, jobId, mapping)) }));
}
export async function commitImportAction(jobId: string) {
  return run(async (a) => ({ ...(await commitImport(a, jobId)) }), [LIST]);
}
