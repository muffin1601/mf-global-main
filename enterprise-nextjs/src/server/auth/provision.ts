import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Creates a Supabase Auth identity for every migrated application user and links it via users.auth_user_id.
 *
 *  - Legacy bcrypt hashes are NEVER copied: each identity gets a random, unrecorded password, so nobody can log
 *    in until they complete the password-reset onboarding.
 *  - Roles, usernames, user codes and enabled/disabled state are untouched (they already live in `users`);
 *    disabled users get a BANNED identity so they cannot sign in at the Supabase layer either.
 *  - Idempotent: re-running links identities that already exist (e.g. after a partial failure) and skips
 *    users that are already linked.
 *  - Dry-run by default. Invitation emails are sent only when `sendInvites` is set explicitly.
 */
export interface AuthAdminPort {
  findUserIdByEmail(email: string): Promise<string | null>;
  createUser(input: { email: string; password: string; metadata: Record<string, string>; banned: boolean }): Promise<{ id: string }>;
  sendRecoveryEmail?(email: string): Promise<void>;
}

export type ProvisionOptions = { apply: boolean; sendInvites?: boolean };
export type ProvisionReport = {
  mode: "dry-run" | "apply";
  considered: number;
  alreadyLinked: number;
  created: number;
  linkedExisting: number;
  skippedNoEmail: string[]; // user codes only (no PII)
  bannedBecauseDisabled: number;
  invitesSent: number;
  failures: { userCode: string; reason: string }[];
  plan: { userCode: string; role: string; enabled: boolean; action: "create" | "link-existing" }[];
  hasLinkedEnabledAdmin: boolean;
};

const randomPassword = () => `${randomBytes(24).toString("base64url")}aA1!`;
const safeReason = (e: unknown) => String((e as { message?: string })?.message ?? e).replace(/\S+@\S+/g, "<email>").slice(0, 160);

export async function provisionAuthUsers(
  db: Pick<PrismaClient, "user">,
  auth: AuthAdminPort,
  options: ProvisionOptions,
): Promise<ProvisionReport> {
  const users = await db.user.findMany({ orderBy: { userId: "asc" }, select: { id: true, userId: true, name: true, username: true, email: true, role: true, enabled: true, authUserId: true } });
  const report: ProvisionReport = {
    mode: options.apply ? "apply" : "dry-run", considered: users.length, alreadyLinked: 0, created: 0, linkedExisting: 0,
    skippedNoEmail: [], bannedBecauseDisabled: 0, invitesSent: 0, failures: [], plan: [], hasLinkedEnabledAdmin: false,
  };
  const invite: string[] = [];

  for (const user of users) {
    if (user.authUserId) { report.alreadyLinked++; continue; }
    if (!user.email) { report.skippedNoEmail.push(user.userId); continue; }
    try {
      const existing = await auth.findUserIdByEmail(user.email);
      report.plan.push({ userCode: user.userId, role: user.role, enabled: user.enabled, action: existing ? "link-existing" : "create" });
      if (!options.apply) continue;
      let authId = existing;
      if (!authId) {
        const created = await auth.createUser({
          email: user.email, password: randomPassword(), banned: !user.enabled,
          metadata: { name: user.name, username: user.username ?? "", userId: user.userId },
        });
        authId = created.id;
        report.created++;
        if (!user.enabled) report.bannedBecauseDisabled++;
        if (user.enabled) invite.push(user.email);
      } else {
        report.linkedExisting++;
      }
      await db.user.update({ where: { id: user.id }, data: { authUserId: authId } });
    } catch (error) {
      report.failures.push({ userCode: user.userId, reason: safeReason(error) });
    }
  }

  if (options.apply && options.sendInvites && auth.sendRecoveryEmail) {
    for (const email of invite) {
      try { await auth.sendRecoveryEmail(email); report.invitesSent++; } catch { /* counted by absence; never log the address */ }
    }
  }

  const finalUsers = options.apply
    ? await db.user.findMany({ where: { role: "ADMIN", enabled: true, authUserId: { not: null } }, select: { id: true } })
    : users.filter((u) => u.role === "ADMIN" && u.enabled && u.authUserId);
  report.hasLinkedEnabledAdmin = finalUsers.length > 0;
  return report;
}
