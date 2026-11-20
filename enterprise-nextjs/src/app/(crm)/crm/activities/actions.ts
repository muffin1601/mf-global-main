"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import type { Actor } from "@/server/actor";
import { HttpError } from "@/server/errors";
import {
  addActivityComment, cancelActivity, completeActivity, createActivity, deleteActivity, reopenActivity, updateActivity,
} from "@/server/activities/service";

export type ActivityActionResult = { ok: true } | { ok: false; error: string };

/** What the activity dialog submits. Dates are `datetime-local` strings interpreted as IST. */
export type ActivityFormValues = {
  type: string; subject: string; body: string; priority: string; dueAt: string;
  leadId?: string; assigneeId?: string; completed?: boolean; outcome?: string;
};

const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
/** "2026-11-20T15:30" (as typed in India) -> the absolute instant. Blank -> null. */
async function istLocalToDate(v: string | undefined): Promise<Date | null> {
  if (!v) return null;
  if (!LOCAL_DT.test(v)) throw new HttpError(400, "Enter a valid date and time.", "BAD_REQUEST");
  return new Date(`${v}:00+05:30`);
}

async function run(fn: (a: Actor) => Promise<unknown>, paths: string[] = []): Promise<ActivityActionResult> {
  const u = await requireUser();
  const a: Actor = { id: u.id, role: u.role, name: u.name, userId: u.userId, email: u.email };
  try {
    await fn(a);
    revalidatePath("/crm/activities");
    for (const p of paths) revalidatePath(p);
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("activity action failed", error instanceof Error ? error.message : String(error));
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const leadPath = (leadId?: string | null) => (leadId ? [`/crm/lead-management/${leadId}`] : []);

export async function createActivityAction(v: ActivityFormValues) {
  return run(async (a) => createActivity(a, {
    type: v.type as never, subject: v.subject, body: v.body, priority: (v.priority || "MEDIUM") as never,
    dueAt: await istLocalToDate(v.dueAt), leadId: v.leadId || null, assigneeId: v.assigneeId || null,
    completed: Boolean(v.completed), outcome: v.outcome || null,
  }), [...leadPath(v.leadId), "/crm/entrydashboard"]);
}

export async function updateActivityAction(id: string, v: Partial<ActivityFormValues>, leadId?: string | null) {
  return run(async (a) => updateActivity(a, id, {
    ...(v.subject !== undefined ? { subject: v.subject } : {}), ...(v.body !== undefined ? { body: v.body } : {}),
    ...(v.priority ? { priority: v.priority as never } : {}), ...(v.dueAt !== undefined ? { dueAt: await istLocalToDate(v.dueAt) } : {}),
    ...(v.assigneeId !== undefined ? { assigneeId: v.assigneeId || null } : {}), ...(v.outcome !== undefined ? { outcome: v.outcome || null } : {}),
  }), leadPath(leadId));
}

export async function completeActivityAction(id: string, outcome?: string, leadId?: string | null) {
  return run((a) => completeActivity(a, id, outcome?.trim() ? outcome : undefined), [...leadPath(leadId), "/crm/entrydashboard"]);
}
export async function reopenActivityAction(id: string, leadId?: string | null) { return run((a) => reopenActivity(a, id), leadPath(leadId)); }
export async function cancelActivityAction(id: string, leadId?: string | null) { return run((a) => cancelActivity(a, id), leadPath(leadId)); }
export async function deleteActivityAction(id: string, leadId?: string | null) { return run((a) => deleteActivity(a, id), leadPath(leadId)); }
export async function commentActivityAction(id: string, body: string, leadId?: string | null) { return run((a) => addActivityComment(a, id, body), leadPath(leadId)); }
