"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { isDateString, istDayStart } from "@/lib/time/ist";
import type { Actor } from "@/server/actor";
import { HttpError } from "@/server/errors";
import { isLeadPreset, parseLeadFilter, type LeadPreset } from "@/server/leads/filter-schema";
import {
  addAdditionalContact, assignLeads, bulkUpdateLeads, createManualLead, deleteAdditionalContact, deleteAllFiltered, deleteLeads,
  bulkSetLeadFields, removeAssignments, transferAssignments, updateLead, type AssignLevel,
} from "@/server/leads/mutations";
import { checkDuplicate, getLeadDetail } from "@/server/leads/queries";
import type { DuplicateCheck, LeadDetail } from "@/server/leads/types";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** The editable lead form as the browser holds it: every value is a string ("" = blank). */
export type LeadFormValues = {
  name: string; company: string; email: string; countryCode: string; phone: string; contact: string; location: string; state: string;
  category: string; dataType: string; quantity: string; requirements: string; remarks: string; address: string;
  status: string; callStatus: string;
  /** Omitted when unchanged so re-saving a form never consumes a follow-up slot or clears the calling date. */
  followUpDate?: string; callingDate?: string;
  billing: AddressValues; shipping: AddressValues;
  assignedUserId?: string;
  /** Edit only. "" clears the priority; tags are comma separated. Omitted = unchanged. */
  priority?: string; tags?: string;
};
export type AddressValues = { street: string; city: string; state: string; postalCode: string; country: string };

async function actor(): Promise<Actor> {
  const u = await requireUser();
  return { id: u.id, role: u.role, name: u.name, userId: u.userId, email: u.email };
}

async function run<T extends object>(fn: (a: Actor) => Promise<T>): Promise<ActionResult<T>> {
  const a = await actor(); // redirects when signed out
  try {
    const result = await fn(a);
    revalidatePath("/crm", "layout");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("lead action failed", error instanceof Error ? error.message : String(error));
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const istDate = (v: string) => (isDateString(v) ? istDayStart(v) : null);
const blankAddress = (a: AddressValues) => Object.values(a).every((x) => !x.trim());

function toInput(v: LeadFormValues, a: Actor, mode: "create" | "update") {
  const admin = a.role === "ADMIN";
  const quantity = v.quantity.trim() === "" ? null : Number(v.quantity);
  const out = {
    name: v.name, email: v.email, countryCode: v.countryCode, location: v.location, state: v.state, category: v.category,
    dataType: v.dataType, requirements: v.requirements, remarks: v.remarks, address: v.address,
    quantity: Number.isFinite(quantity) ? quantity : null,
    ...(v.status ? { status: v.status as never } : {}), ...(v.callStatus ? { callStatus: v.callStatus as never } : {}),
    followUpDate: v.followUpDate ? istDate(v.followUpDate) : undefined,
    callingDate: v.callingDate === undefined ? undefined : istDate(v.callingDate),
    // Identity fields are administrator-only on edit (non-admins never send them).
    ...(mode === "create" || admin ? { phone: v.phone, company: v.company, contact: v.contact } : {}),
  };
  return out;
}

export async function createLeadAction(values: LeadFormValues): Promise<ActionResult<{ id: string }>> {
  return run(async (a) => createManualLead(a, { ...toInput(values, a, "create"), assignedUserId: values.assignedUserId || null }));
}

export async function updateLeadAction(id: string, values: LeadFormValues): Promise<ActionResult<{ id: string }>> {
  return run(async (a) =>
    updateLead(a, id, {
      ...toInput(values, a, "update"),
      ...(values.priority !== undefined ? { priority: (values.priority || null) as never } : {}),
      ...(values.tags !== undefined ? { tags: values.tags.split(",").map((t) => t.trim()).filter(Boolean) } : {}),
      billingAddress: blankAddress(values.billing) ? null : values.billing,
      shippingAddress: blankAddress(values.shipping) ? null : values.shipping,
    }),
  );
}

export async function checkDuplicateAction(input: { phone?: string; contact?: string; excludeId?: string }): Promise<ActionResult<{ result: DuplicateCheck }>> {
  return run(async (a) => ({ result: await checkDuplicate(a, input) }));
}

export async function getLeadDetailAction(id: string): Promise<ActionResult<{ lead: LeadDetail }>> {
  return run(async (a) => ({ lead: await getLeadDetail(a, id) }));
}

export async function addContactAction(id: string, contact: { name: string; contact: string; details: string }): Promise<ActionResult> {
  return run(async (a) => { await addAdditionalContact(a, id, contact); return {}; });
}
export async function deleteContactAction(id: string, index: number): Promise<ActionResult> {
  return run(async (a) => { await deleteAdditionalContact(a, id, index); return {}; });
}

export async function deleteLeadsAction(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  return run((a) => deleteLeads(a, ids));
}
/** `query` is the URL query string of the current view (the filter is rebuilt and re-authorised on the server). */
export async function deleteAllFilteredAction(query: string, preset: string): Promise<ActionResult<{ deleted: number }>> {
  const p: LeadPreset = isLeadPreset(preset) ? preset : "all";
  return run((a) => deleteAllFiltered(a, { filter: parseLeadFilter(new URLSearchParams(query)), preset: p }));
}
export async function bulkUpdateAction(ids: string[], category: string, location: string): Promise<ActionResult<{ updated: number }>> {
  return run((a) => bulkUpdateLeads(a, { ids, category, location }));
}
export async function assignLeadsAction(leadIds: string[], userIds: string[], level: AssignLevel): Promise<ActionResult<{ leads: number; users: number }>> {
  return run((a) => assignLeads(a, { leadIds, userIds, level }));
}
export async function removeAssignmentsAction(leadIds: string[]): Promise<ActionResult<{ leads: number }>> {
  return run((a) => removeAssignments(a, leadIds));
}
export async function transferAssignmentsAction(leadIds: string[], targetUserId: string): Promise<ActionResult<{ leads: number }>> {
  return run((a) => transferAssignments(a, { leadIds, targetUserId }));
}

/** Bulk status / call status / priority / add tags (admin; server re-checks). */
export async function bulkSetFieldsAction(ids: string[], v: { status?: string; callStatus?: string; priority?: string; addTags?: string[] }): Promise<ActionResult<{ updated: number; statusChanged: number }>> {
  return run((a) => bulkSetLeadFields(a, {
    ids, ...(v.status ? { status: v.status as never } : {}), ...(v.callStatus ? { callStatus: v.callStatus as never } : {}),
    ...(v.priority ? { priority: v.priority as never } : {}), ...(v.addTags?.length ? { addTags: v.addTags } : {}),
  }));
}
