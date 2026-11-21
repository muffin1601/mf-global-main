"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { setPassword, verifyPassword } from "@/lib/supabase/password";
import type { Actor } from "@/server/actor";
import { HttpError } from "@/server/errors";
import { changeOwnPassword, updateProfile } from "@/server/profile/service";

export type ProfileActionResult = { ok: true; message: string } | { ok: false; error: string };

async function run(fn: (a: Actor) => Promise<string>): Promise<ProfileActionResult> {
  const u = await requireUser();
  try {
    const message = await fn({ id: u.id, role: u.role, name: u.name, userId: u.userId, email: u.email });
    revalidatePath("/crm", "layout");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.message };
    console.error("profile action failed", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const text = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : undefined);

export async function updateProfileAction(fd: FormData) {
  return run(async (a) => {
    const r = await updateProfile(a, { name: text(fd, "name"), phone: text(fd, "phone"), designation: text(fd, "designation"), location: text(fd, "location") });
    return r.changed.length ? "Profile updated." : "No changes to save.";
  });
}

export async function changeOwnPasswordAction(fd: FormData) {
  return run(async (a) => {
    await changeOwnPassword(a, { current: fd.get("current"), next: fd.get("next"), confirm: fd.get("confirm") }, { verify: verifyPassword, set: setPassword });
    return "Password changed. Use the new password next time you sign in.";
  });
}
