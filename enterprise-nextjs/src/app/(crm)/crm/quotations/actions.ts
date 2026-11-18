"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { HttpError } from "@/server/errors";
import { createQuotation, deleteQuotation, updateQuotation } from "@/server/quotations/service";

export type SaveResult = { ok: true; id: string; number: string } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof HttpError) return { ok: false, error: error.message };
  console.error("quotation action failed", error instanceof Error ? error.message : String(error));
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function saveQuotationAction(id: string | null, payload: unknown): Promise<SaveResult> {
  try {
    const user = await requireUser();
    const actor = { id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email };
    const q = id ? await updateQuotation(actor, id, payload) : await createQuotation(actor, payload);
    revalidatePath("/crm/quotations");
    return { ok: true, id: q.id, number: `${String(q.invoiceDetails.prefix ?? "")}${String(q.invoiceDetails.number ?? "")}` };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteQuotationAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    await deleteQuotation({ id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email }, id);
    revalidatePath("/crm/quotations");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
