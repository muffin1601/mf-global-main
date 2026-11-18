// Create + link Supabase Auth identities for migrated users.
//   dry run (default):  npx tsx scripts/provision-auth-users.ts
//   apply:              npx tsx scripts/provision-auth-users.ts --apply
//   send reset emails:  ... --apply --send-invites      (NEVER without owner approval: real emails)
// Writing to a Supabase project requires ALLOW_PRODUCTION_WRITE=I_HAVE_WRITTEN_APPROVAL (use a staging project).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../generated/prisma/client";
import { provisionAuthUsers, type AuthAdminPort } from "../src/server/auth/provision";
import { assertSafeWriteTarget } from "./migrate-mongodb/lib";

const apply = process.argv.includes("--apply");
const sendInvites = process.argv.includes("--send-invites");
const need = (name: string) => { const v = process.env[name]; if (!v) throw new Error(`Missing required environment variable name: ${name}`); return v; };

async function main() {
  const databaseUrl = need("DATABASE_URL");
  const supabaseUrl = need("NEXT_PUBLIC_SUPABASE_URL");
  const secret = need("SUPABASE_SECRET_KEY");
  if (apply) { assertSafeWriteTarget(databaseUrl); assertSafeWriteTarget(supabaseUrl); }

  const admin = createClient(supabaseUrl, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(supabaseUrl, need("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), { auth: { persistSession: false } });
  const appUrl = need("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");

  const port: AuthAdminPort = {
    async findUserIdByEmail(email) {
      for (let page = 1; page <= 50; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw new Error("listUsers failed");
        const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (hit) return hit.id;
        if (data.users.length < 200) return null;
      }
      return null;
    },
    async createUser({ email, password, metadata, banned }) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata, ...(banned ? { ban_duration: "876000h" } : {}) });
      if (error || !data.user) throw new Error("createUser failed");
      return { id: data.user.id };
    },
    async sendRecoveryEmail(email) {
      const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/auth/callback?next=/crm/reset-password` });
      if (error) throw new Error("recovery email failed");
    },
  };

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const report = await provisionAuthUsers(prisma, port, { apply, sendInvites });
    console.log(JSON.stringify(report, null, 2));
    if (report.failures.length || (apply && !report.hasLinkedEnabledAdmin)) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error("provision failed:", String(e?.message ?? e).replace(/\/\/[^@\s]*@/g, "//***@")); process.exit(2); });
