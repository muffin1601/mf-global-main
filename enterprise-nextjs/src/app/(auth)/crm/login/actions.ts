"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { hashForKey, rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };
const loginSchema = z.object({ identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(256) });
const GENERIC = "The username or password is incorrect.";
const TOO_MANY = "Too many sign-in attempts. Please wait a few minutes and try again.";

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your username or email and password." };
  const identifier = parsed.data.identifier.toLowerCase();

  // Throttle per client IP (credential stuffing) AND per identifier (targeted guessing). Original: 10 / 15 min.
  const h = await headers();
  const ip = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const [byIp, byAccount] = await Promise.all([
    rateLimit(`login:ip:${hashForKey(ip)}`, 10, 15 * 60_000),
    rateLimit(`login:id:${hashForKey(identifier)}`, 10, 15 * 60_000),
  ]);
  if (!byIp.allowed || !byAccount.allowed) return { error: TOO_MANY };

  const applicationUser = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
    select: { email: true, enabled: true, authUserId: true },
  });
  if (!applicationUser?.email || !applicationUser.authUserId) return { error: GENERIC };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: applicationUser.email, password: parsed.data.password });
  if (error) return { error: GENERIC };

  // The disabled state is revealed only AFTER the password was proven correct, so it cannot be used to
  // discover which usernames exist.
  if (!applicationUser.enabled) {
    await supabase.auth.signOut();
    return { error: "This account is disabled. Contact an administrator." };
  }
  redirect("/crm/entrydashboard");
}
