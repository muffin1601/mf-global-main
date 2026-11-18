import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeUser, prisma, resetDb } from "./helpers/db";

const state = vi.hoisted(() => ({
  ip: "1.1.1.1",
  signIn: vi.fn(async ({ password }: { password: string }) => (password === "correct-password-1" ? { error: null } : { error: { message: "bad" } })),
  signOut: vi.fn(async () => ({})),
  exchange: vi.fn(async (code: string) => ({ error: code === "good" ? null : { message: "bad" } })),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": state.ip }), cookies: async () => ({ get: () => undefined, getAll: () => [] }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signInWithPassword: state.signIn, signOut: state.signOut, exchangeCodeForSession: state.exchange } }),
}));

import { safeNextPath } from "@/lib/security/redirect";
import { loginAction } from "@/app/(auth)/crm/login/actions";
import { GET as callback } from "@/app/auth/callback/route";

const form = (identifier: string, password: string) => { const f = new FormData(); f.set("identifier", identifier); f.set("password", password); return f; };

describe("SEC-03 open redirect", () => {
  const FALLBACK = "/crm/entrydashboard";
  it("accepts ordinary internal paths", () => {
    expect(safeNextPath("/crm/reset-password", FALLBACK)).toBe("/crm/reset-password");
    expect(safeNextPath("/crm/lead-management?page=2", FALLBACK)).toBe("/crm/lead-management?page=2");
  });
  it.each([
    "//evil.com", "/\\evil.com", "/%5Cevil.com", "/\t/evil.com", "/%09/evil.com", "/\r\n/evil.com", "https://evil.com", "http://evil.com/x",
    "javascript:alert(1)", "evil.com", "/%2F%2Fevil.com", "/..\\evil.com", "",
  ])("rejects %j", (bad) => {
    expect(safeNextPath(bad, FALLBACK)).toBe(FALLBACK);
  });
  it("the callback route never redirects off-site, and marks recovery sessions", async () => {
    const evil = await callback(new Request("http://app.test/auth/callback?code=good&next=/%5Cevil.com"));
    expect(new URL(evil.headers.get("location")!).origin).toBe("http://app.test");
    expect(new URL(evil.headers.get("location")!).pathname).toBe("/crm/entrydashboard");
    const recovery = await callback(new Request("http://app.test/auth/callback?code=good&next=/crm/reset-password"));
    expect(recovery.headers.get("set-cookie")).toMatch(/pw_recovery=1;.*HttpOnly/i);
    const ordinary = await callback(new Request("http://app.test/auth/callback?code=good&next=/crm/lead-management"));
    expect(ordinary.headers.get("set-cookie") ?? "").not.toContain("pw_recovery");
    const failed = await callback(new Request("http://app.test/auth/callback?code=bad"));
    expect(failed.headers.get("location")).toContain("/crm/login?error=auth_callback");
  });
});

describe("SEC-04 / SEC-09 login hardening", () => {
  beforeEach(async () => { await resetDb(); state.signIn.mockClear(); state.signOut.mockClear(); state.ip = `10.0.0.${Math.floor(Math.random() * 200)}`; });

  it("gives the same generic message for unknown user and wrong password", async () => {
    const user = await makeUser();
    const unknown = await loginAction({}, form("nobody", "x"));
    const wrong = await loginAction({}, form(user.username!, "wrong"));
    expect(unknown.error).toBe("The username or password is incorrect.");
    expect(wrong.error).toBe(unknown.error);
  });

  it("does not reveal that an account is disabled unless the password is correct", async () => {
    const disabled = await makeUser({ enabled: false });
    expect((await loginAction({}, form(disabled.username!, "wrong"))).error).toBe("The username or password is incorrect.");
    expect(state.signOut).not.toHaveBeenCalled();
    const ok = await loginAction({}, form(disabled.username!, "correct-password-1"));
    expect(ok.error).toMatch(/disabled/i);
    expect(state.signOut).toHaveBeenCalled(); // the session that sign-in created is discarded
  });

  it("signs an enabled user in and redirects", async () => {
    const user = await makeUser();
    await expect(loginAction({}, form(user.email!, "correct-password-1"))).rejects.toThrow("REDIRECT:/crm/entrydashboard");
  });

  it("throttles per IP: the 11th attempt is blocked before Supabase is called", async () => {
    const user = await makeUser();
    for (let i = 0; i < 10; i++) await loginAction({}, form(user.username!, "wrong"));
    state.signIn.mockClear();
    const blocked = await loginAction({}, form(user.username!, "correct-password-1"));
    expect(blocked.error).toMatch(/too many/i);
    expect(state.signIn).not.toHaveBeenCalled();
  });

  it("throttles per account even when the attacker rotates IPs", async () => {
    const user = await makeUser();
    for (let i = 0; i < 10; i++) { state.ip = `20.0.0.${i}`; await loginAction({}, form(user.username!, "wrong")); }
    state.ip = "30.0.0.1";
    expect((await loginAction({}, form(user.username!, "correct-password-1"))).error).toMatch(/too many/i);
  });

  it("stores no raw identifier or IP in the limiter table", async () => {
    const user = await makeUser();
    await loginAction({}, form(user.username!, "wrong"));
    const keys = (await prisma.rateLimitBucket.findMany()).map((b) => b.key).join(" ");
    expect(keys).not.toContain(user.username!);
    expect(keys).not.toContain(state.ip);
  });
});

describe("SEC-12 / SEC-07 / PERF-01 static and structural guarantees", () => {
  it("keeps server-only variable names out of the browser-safe env module", () => {
    const pub = readFileSync("src/lib/env.public.ts", "utf8");
    for (const name of ["DATABASE_URL", "SUPABASE_SECRET_KEY", "RESEND_API_KEY", "IP_HASH_SALT", "DIRECT_URL"]) expect(pub).not.toContain(name);
    expect(readFileSync("src/lib/supabase/browser.ts", "utf8")).toContain("@/lib/env.public");
    expect(readFileSync("src/lib/env.ts", "utf8")).toContain('import "server-only"');
  });
  it("sends HSTS and a report-only CSP", () => {
    const cfg = readFileSync("next.config.ts", "utf8");
    expect(cfg).toContain("Strict-Transport-Security");
    expect(cfg).toContain("Content-Security-Policy-Report-Only");
    expect(cfg).toContain('serverExternalPackages: ["pdfkit"]');
  });
  it("the proxy skips the Supabase round trip for anonymous requests", async () => {
    const created = vi.fn();
    vi.doMock("@supabase/ssr", () => ({ createServerClient: (...a: unknown[]) => { created(...a); return { auth: { getUser: async () => ({}) } }; } }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "k");
    vi.resetModules();
    const { proxy } = await import("@/proxy");
    const { NextRequest } = await import("next/server");
    await proxy(new NextRequest("http://app.test/api/careers/jobs"));
    expect(created).not.toHaveBeenCalled();
    await proxy(new NextRequest("http://app.test/crm/entrydashboard", { headers: { cookie: "sb-abc-auth-token=x" } }));
    expect(created).toHaveBeenCalledTimes(1);
    vi.doUnmock("@supabase/ssr");
  });
});
