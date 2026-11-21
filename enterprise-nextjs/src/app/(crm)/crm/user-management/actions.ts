"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Prisma } from "@/generated/prisma/client";

/*
 * Every action RETURNS { error } instead of throwing: in production Next.js replaces a thrown message with a
 * generic digest, so an administrator would never learn why a change was refused (duplicate email, last admin...).
 */
export type UserActionResult = { error?: string };

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/),
  email: z.email().toLowerCase(),
  password: z.string().min(12).max(256),
  role: z.enum(["ADMIN", "USER"]),
  location: z.string().trim().max(120).optional(),
});

// Legacy rows may have no email; the edit form then posts "" which must mean "leave unchanged", not "invalid".
const updateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.union([z.literal(""), z.email()]).optional().transform((v) => (v ? v.toLowerCase() : undefined)),
  location: z.string().trim().max(120).optional(),
});

const invalid = (error: z.ZodError) => ({ error: error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") });

/** Next free employee code for the initial. Codes share one namespace across roles, so probe until free. */
async function nextUserCode(tx: Prisma.TransactionClient, role: "ADMIN" | "USER", initial: string) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const { seq } = await tx.userSequence.upsert({ where: { role }, create: { role, seq: 1 }, update: { seq: { increment: 1 } } });
    const code = `${initial}${String(seq).padStart(3, "0")}`;
    if (!(await tx.user.findUnique({ where: { userId: code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not allocate an employee code.");
}

export async function createUserAction(formData: FormData): Promise<UserActionResult> {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const exists = await prisma.user.findFirst({ where: { OR: [{ username: input.username }, { email: input.email }] }, select: { id: true } });
  if (exists) return { error: "A user with that username or email already exists." };
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: { name: input.name, username: input.username } });
  if (error || !data.user) return { error: error?.message ? `Sign-in account could not be created: ${error.message}` : "Sign-in account could not be created." };
  try {
    await prisma.$transaction(async (tx) => {
      const userId = await nextUserCode(tx, input.role, input.name.charAt(0).toUpperCase() || "U");
      const user = await tx.user.create({ data: { authUserId: data.user.id, userId, name: input.name, username: input.username, email: input.email, location: input.location || null, role: input.role } });
      await tx.activityLog.create({ data: { userId: admin.id, action: "user.created", details: { targetUserId: user.id, targetUserCode: user.userId, role: user.role } } });
    });
  } catch (err) {
    await supabase.auth.admin.deleteUser(data.user.id);
    console.error("createUserAction failed", err);
    return { error: "The user could not be saved. Please try again." };
  }
  revalidatePath("/crm/user-management");
  return {};
}

export async function toggleUserAction(formData: FormData): Promise<UserActionResult> {
  const admin = await requireAdmin();
  const targetId = z.uuid().safeParse(formData.get("id"));
  if (!targetId.success) return { error: "Unknown user." };
  if (targetId.data === admin.id) return { error: "You cannot disable your own account." };
  return prisma.$transaction(async (tx) => {
    // Serialise enable/disable so two admins cannot disable each other at the same moment.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('user-enabled-toggle'))`;
    const target = await tx.user.findUnique({ where: { id: targetId.data }, select: { enabled: true, userId: true, role: true } });
    if (!target) return { error: "Unknown user." };
    if (target.enabled && target.role === "ADMIN") {
      const otherAdmins = await tx.user.count({ where: { role: "ADMIN", enabled: true, id: { not: targetId.data } } });
      if (otherAdmins < 1) return { error: "At least one administrator must stay enabled." };
    }
    await tx.user.update({ where: { id: targetId.data }, data: { enabled: !target.enabled } });
    await tx.activityLog.create({ data: { userId: admin.id, action: target.enabled ? "user.disabled" : "user.enabled", details: { targetUserId: targetId.data, targetUserCode: target.userId } } });
    return {};
  }).then((r) => { revalidatePath("/crm/user-management"); return r; });
}

export async function changePasswordAction(formData: FormData): Promise<UserActionResult> {
  const admin = await requireAdmin();
  const parsed = z.object({ id: z.uuid(), password: z.string().min(12).max(256) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "The password must be at least 12 characters." };
  const target = await prisma.user.findUnique({ where: { id: parsed.data.id }, select: { authUserId: true, enabled: true, userId: true } });
  if (!target) return { error: "Unknown user." };
  if (!target.enabled) return { error: "Enable the account before changing its password." };
  if (!target.authUserId) return { error: "This user is not linked to a sign-in account." };
  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(target.authUserId, { password: parsed.data.password });
  if (error) return { error: `The password was not changed: ${error.message}` };
  await prisma.activityLog.create({ data: { userId: admin.id, action: "user.password_changed", details: { targetUserId: parsed.data.id, targetUserCode: target.userId } } });
  revalidatePath("/crm/user-management");
  return {};
}

export async function updateUserAction(formData: FormData): Promise<UserActionResult> {
  const admin = await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const target = await prisma.user.findUnique({ where: { id: input.id }, select: { id: true, userId: true, name: true, email: true, location: true, authUserId: true } });
  if (!target) return { error: "Unknown user." };
  const location = input.location || null;
  const newEmail = input.email && input.email !== target.email ? input.email : undefined;
  if (newEmail) {
    const exists = await prisma.user.findFirst({ where: { email: newEmail, id: { not: input.id } }, select: { id: true } });
    if (exists) return { error: "This email is already in use by another user." };
  }

  // Sign-in uses the CRM email to call Supabase Auth, and password recovery mails the Supabase email. Both must
  // change together: updating only the CRM row locked the user out and left recovery with the OLD mailbox.
  const supabase = newEmail && target.authUserId ? createSupabaseAdminClient() : null;
  if (supabase && target.authUserId && newEmail) {
    const { error } = await supabase.auth.admin.updateUserById(target.authUserId, { email: newEmail, email_confirm: true });
    if (error) return { error: `The sign-in email could not be changed: ${error.message}` };
  }
  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: input.id }, data: { name: input.name, location, ...(newEmail ? { email: newEmail } : {}) } }),
      prisma.activityLog.create({
        data: {
          userId: admin.id, action: "user.updated",
          details: {
            targetUserId: input.id, targetUserCode: target.userId,
            changes: {
              name: target.name !== input.name ? { old: target.name, new: input.name } : undefined,
              email: newEmail ? { old: target.email, new: newEmail } : undefined,
              location: (target.location ?? null) !== location ? { old: target.location, new: location } : undefined,
            },
          },
        },
      }),
    ]);
  } catch (err) {
    // Keep Supabase and the CRM consistent: roll the sign-in email back if the CRM write failed.
    if (supabase && target.authUserId && target.email) await supabase.auth.admin.updateUserById(target.authUserId, { email: target.email, email_confirm: true });
    console.error("updateUserAction failed", err);
    return { error: "The change was not saved. Please try again." };
  }
  revalidatePath("/crm/user-management");
  return {};
}
