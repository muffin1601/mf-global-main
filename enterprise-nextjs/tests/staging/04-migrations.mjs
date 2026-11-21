// Migration history on a shared database (READ-ONLY): one SELECT on _prisma_migrations via the checksum verifier.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { guard } from "./guard.mjs";

guard(["VERIFY_DATABASE_URL"]);
let out = "", code = 0;
try {
  out = execFileSync(process.execPath, ["scripts/verify-migration-checksums.mjs"], { env: process.env, encoding: "utf8" });
} catch (e) { out = String(e.stdout ?? ""); code = e.status ?? 1; }
writeFileSync("test-artifacts/staging/migrations.txt", out);
console.log(out);
if (!/20261120145700_remove_non_admin_users/.test(out)) console.log("Note: 20261120145700 not listed - check the migrations folder.");
if (/OK\s+20261120145700_remove_non_admin_users\s+50bac0a81f6c/.test(out)) console.log("20261120145700 is applied and is the approved disable-only revision.");
if (/PENDING\s+20261120145700/.test(out)) console.log("20261120145700 is pending here: deploying will disable all USER accounts (approved behaviour).");
process.exitCode = code;
