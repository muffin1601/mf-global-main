import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return prisma.user.findUnique({
    where: { authUserId: data.user.id },
    select: { id: true, authUserId: true, userId: true, name: true, email: true, role: true, enabled: true }
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/crm/login");
  if (!user.enabled) redirect("/crm/login?error=disabled");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/crm/entrydashboard?error=forbidden");
  return user;
}
