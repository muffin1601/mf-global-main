// Shared safety guard for the staging pack. Import first in every script.
import { mkdirSync, writeFileSync } from "node:fs";

export function guard(required = []) {
  if (process.env.STAGING_CONFIRM !== "I-UNDERSTAND-THIS-IS-STAGING") {
    console.error("Refusing to run: set STAGING_CONFIRM=I-UNDERSTAND-THIS-IS-STAGING (staging only).");
    process.exit(2);
  }
  const pattern = process.env.PRODUCTION_HOST_PATTERN;
  if (!pattern) { console.error("Refusing to run: set PRODUCTION_HOST_PATTERN to a regex matching production hostnames."); process.exit(2); }
  const prod = new RegExp(pattern, "i");
  for (const key of ["STAGING_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "VERIFY_DATABASE_URL", "SOURCE_DATABASE_URL", "RESTORED_DATABASE_URL"]) {
    const v = process.env[key];
    if (v && prod.test(hostOf(v))) { console.error(`Refusing to run: ${key} points at a production host (${hostOf(v)}).`); process.exit(2); }
  }
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) { console.error("Missing environment: " + missing.join(", ")); process.exit(2); }
  mkdirSync("test-artifacts/staging", { recursive: true });
}

export const hostOf = (url) => { try { return new URL(url).hostname; } catch { return "(invalid url)"; } };

export function reporter(name) {
  const results = [];
  return {
    async check(label, fn) {
      try { const note = await fn(); results.push({ label, pass: true, note: note ?? "" }); console.log("PASS", label, note ? `- ${note}` : ""); }
      catch (e) { results.push({ label, pass: false, error: String(e?.message ?? e).slice(0, 300) }); console.log("FAIL", label, "-", String(e?.message ?? e).slice(0, 300)); }
    },
    done() {
      writeFileSync(`test-artifacts/staging/${name}.json`, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
      const failed = results.filter((r) => !r.pass).length;
      console.log(`${name}: ${results.length - failed}/${results.length} passed`);
      if (failed) process.exitCode = 1;
    },
  };
}
export const expect = (c, m) => { if (!c) throw new Error(m); };
