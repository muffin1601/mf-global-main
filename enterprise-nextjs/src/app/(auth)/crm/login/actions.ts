"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };
const loginSchema = z.object({ identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(256) });

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your username or email and password." };
  const identifier = parsed.data.identifier.toLowerCase();
  const applicationUser = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
    select: { email: true, enabled: true, authUserId: true }
  });
  if (!applicationUser?.email || !applicationUser.authUserId) return { error: "The username or password is incorrect." };
  if (!applicationUser.enabled) return { error: "This account is disabled. Contact an administrator." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: applicationUser.email, password: parsed.data.password });
  if (error) return { error: "The username or password is incorrect." };
  redirect("/crm/entrydashboard");
}
