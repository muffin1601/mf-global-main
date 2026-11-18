import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasVendorPermission, type VendorPermission } from "@/lib/permissions";
import type { Actor } from "@/server/actor";
import { HttpError } from "@/server/errors";

export async function getActor(): Promise<Actor> {
  const u = await requireUser();
  return { id: u.id, role: u.role, name: u.name, userId: u.userId, email: u.email };
}

export const permsOf = (actor: Actor) => {
  const can = (p: VendorPermission) => hasVendorPermission(actor.role, p);
  return {
    view: can("vendor.view"), create: can("vendor.create"), edit: can("vendor.edit"), archive: can("vendor.archive"), delete: can("vendor.delete"),
    export: can("vendor.export"), import: can("vendor.import"), documents: can("vendor.documents"), performance: can("vendor.performance"),
    categories: can("vendor.manage_categories"), viewBank: can("vendor.view_bank"), editBank: can("vendor.edit_bank"),
  };
};
export type Perms = ReturnType<typeof permsOf>;

/** Run a page-level service call: 404/400 become Next's not-found page, other errors propagate to the error boundary. */
export async function orNotFound<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof HttpError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
}

export type SP = Record<string, string | string[] | undefined>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "-";
export const fmtDateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "-";
export const dateInput = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
