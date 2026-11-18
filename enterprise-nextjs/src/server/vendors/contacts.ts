import { prisma } from "@/lib/prisma/client";
import { notFound } from "@/server/errors";
import { audit, authorize, failIf, loadVendor, requireId, type MaybeActor } from "./common";
import { clean, has, normalizeEmail, validateAddress, validateContact, type Input } from "./fields";

/* --------------------------------------------------------------- contacts */
export async function listContacts(actor: MaybeActor, vendorId: string) {
  authorize(actor, "vendor.view");
  const v = await loadVendor(vendorId);
  return prisma.vendorContact.findMany({ where: { vendorId: v.id }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] });
}

const contactData = (i: Input) => ({
  name: String(i.name).trim(), designation: clean(i.designation), email: has(i.email) ? normalizeEmail(i.email) : null, phone: clean(i.phone),
});

export async function addContact(actor: MaybeActor, vendorId: string, input: Input) {
  const a = authorize(actor, "vendor.edit");
  const v = await loadVendor(vendorId);
  failIf(validateContact(input));
  return prisma.$transaction(async (tx) => {
    const existing = await tx.vendorContact.count({ where: { vendorId: v.id } });
    const primary = input.isPrimary === true || existing === 0;
    if (primary) await tx.vendorContact.updateMany({ where: { vendorId: v.id }, data: { isPrimary: false } });
    const c = await tx.vendorContact.create({ data: { ...contactData(input), vendorId: v.id, isPrimary: primary } });
    await audit(tx, a, "vendor.contact_added", v, { contact: c.name });
    return c;
  });
}

async function ownContact(vendorId: string, contactId: string) {
  const v = await loadVendor(vendorId);
  const c = await prisma.vendorContact.findUnique({ where: { id: requireId(contactId, "contact") } });
  if (!c || c.vendorId !== v.id) throw notFound("Contact not found for this vendor");
  return { v, c };
}

export async function updateContact(actor: MaybeActor, vendorId: string, contactId: string, input: Input) {
  const a = authorize(actor, "vendor.edit");
  const { v, c } = await ownContact(vendorId, contactId);
  failIf(validateContact({ ...c, ...input }));
  return prisma.$transaction(async (tx) => {
    if (input.isPrimary === true && !c.isPrimary) await tx.vendorContact.updateMany({ where: { vendorId: v.id }, data: { isPrimary: false } });
    const u = await tx.vendorContact.update({ where: { id: c.id }, data: { ...contactData({ ...c, ...input }), ...(input.isPrimary === true ? { isPrimary: true } : {}) } });
    await audit(tx, a, "vendor.contact_updated", v, { contact: u.name });
    return u;
  });
}

export async function setPrimaryContact(actor: MaybeActor, vendorId: string, contactId: string) {
  const a = authorize(actor, "vendor.edit");
  const { v, c } = await ownContact(vendorId, contactId);
  await prisma.$transaction(async (tx) => {
    await tx.vendorContact.updateMany({ where: { vendorId: v.id }, data: { isPrimary: false } });
    await tx.vendorContact.update({ where: { id: c.id }, data: { isPrimary: true } });
    await audit(tx, a, "vendor.contact_primary", v, { contact: c.name });
  });
  return { ok: true as const };
}

export async function deleteContact(actor: MaybeActor, vendorId: string, contactId: string) {
  const a = authorize(actor, "vendor.edit");
  const { v, c } = await ownContact(vendorId, contactId);
  await prisma.$transaction(async (tx) => {
    await tx.vendorContact.delete({ where: { id: c.id } });
    if (c.isPrimary) {
      const next = await tx.vendorContact.findFirst({ where: { vendorId: v.id }, orderBy: { name: "asc" } });
      if (next) await tx.vendorContact.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await audit(tx, a, "vendor.contact_deleted", v, { contact: c.name });
  });
  return { ok: true as const };
}

/* -------------------------------------------------------------- addresses */
export async function listAddresses(actor: MaybeActor, vendorId: string) {
  authorize(actor, "vendor.view");
  const v = await loadVendor(vendorId);
  return prisma.vendorAddress.findMany({ where: { vendorId: v.id }, orderBy: [{ isPrimary: "desc" }, { type: "asc" }] });
}

const addressData = (i: Input) => ({
  type: has(i.type) ? String(i.type) : "Registered Office", line1: clean(i.line1), line2: clean(i.line2), city: clean(i.city),
  state: clean(i.state), postalCode: clean(i.postalCode), country: clean(i.country) ?? "India",
});

export async function addAddress(actor: MaybeActor, vendorId: string, input: Input) {
  const a = authorize(actor, "vendor.edit");
  const v = await loadVendor(vendorId);
  failIf(validateAddress(input));
  return prisma.$transaction(async (tx) => {
    const existing = await tx.vendorAddress.count({ where: { vendorId: v.id } });
    const primary = input.isPrimary === true || existing === 0;
    if (primary) await tx.vendorAddress.updateMany({ where: { vendorId: v.id }, data: { isPrimary: false } });
    const x = await tx.vendorAddress.create({ data: { ...addressData(input), vendorId: v.id, isPrimary: primary } });
    await audit(tx, a, "vendor.address_added", v, { type: x.type });
    return x;
  });
}

async function ownAddress(vendorId: string, addressId: string) {
  const v = await loadVendor(vendorId);
  const x = await prisma.vendorAddress.findUnique({ where: { id: requireId(addressId, "address") } });
  if (!x || x.vendorId !== v.id) throw notFound("Address not found for this vendor");
  return { v, x };
}

export async function updateAddress(actor: MaybeActor, vendorId: string, addressId: string, input: Input) {
  const a = authorize(actor, "vendor.edit");
  const { v, x } = await ownAddress(vendorId, addressId);
  failIf(validateAddress({ ...x, ...input }));
  return prisma.$transaction(async (tx) => {
    if (input.isPrimary === true && !x.isPrimary) await tx.vendorAddress.updateMany({ where: { vendorId: v.id }, data: { isPrimary: false } });
    const u = await tx.vendorAddress.update({ where: { id: x.id }, data: { ...addressData({ ...x, ...input }), ...(input.isPrimary === true ? { isPrimary: true } : {}) } });
    await audit(tx, a, "vendor.address_updated", v, { type: u.type });
    return u;
  });
}

export async function setPrimaryAddress(actor: MaybeActor, vendorId: string, addressId: string) {
  const a = authorize(actor, "vendor.edit");
  const { v, x } = await ownAddress(vendorId, addressId);
  await prisma.$transaction(async (tx) => {
    await tx.vendorAddress.updateMany({ where: { vendorId: v.id }, data: { isPrimary: false } });
    await tx.vendorAddress.update({ where: { id: x.id }, data: { isPrimary: true } });
    await audit(tx, a, "vendor.address_primary", v, { type: x.type });
  });
  return { ok: true as const };
}

export async function deleteAddress(actor: MaybeActor, vendorId: string, addressId: string) {
  const a = authorize(actor, "vendor.edit");
  const { v, x } = await ownAddress(vendorId, addressId);
  await prisma.$transaction(async (tx) => {
    await tx.vendorAddress.delete({ where: { id: x.id } });
    if (x.isPrimary) {
      const next = await tx.vendorAddress.findFirst({ where: { vendorId: v.id } });
      if (next) await tx.vendorAddress.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await audit(tx, a, "vendor.address_deleted", v, { type: x.type });
  });
  return { ok: true as const };
}
