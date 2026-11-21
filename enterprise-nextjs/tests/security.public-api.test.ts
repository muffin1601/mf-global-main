import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeUser, prisma, resetDb } from "./helpers/db";
import { createMemoryStorage } from "./helpers/storage";
import { setStorageDriverForTests } from "@/lib/storage";

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: "ADMIN" | "USER"; enabled: boolean; name: string; userId: string; email: string | null } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => session.user, requireUser: async () => session.user, requireAdmin: async () => session.user }));

import { POST as careersLogin } from "@/app/api/careers/admin/login/route";
import { GET as careersStats } from "@/app/api/careers/admin/stats/route";
import { POST as careersApply } from "@/app/api/careers/apply/route";
import { POST as postComment } from "@/app/api/blogs/comments/route";
import { POST as postBlog } from "@/app/api/blogs/post-blogs/route";
import { POST as sendEmail } from "@/app/api/send-email/route";
import { POST as contact } from "@/app/api/contact/route";

const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(200, 65)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const asUser = (u: Awaited<ReturnType<typeof makeUser>> | null) => { session.user = u && { id: u.id, role: u.role, enabled: u.enabled, name: u.name, userId: u.userId, email: u.email }; };

async function pinSession() {
  const res = await careersLogin(new Request("http://app.test/api/careers/admin/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "5.5.5.5" }, body: JSON.stringify({ pin: "123456" }) }));
  return { res, cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

beforeEach(async () => {
  await resetDb();
  session.user = null;
  setStorageDriverForTests(createMemoryStorage());
  await prisma.careerAdminSetting.create({ data: { key: "admin", pinHash: bcrypt.hashSync("123456", 4) } });
});

describe("SEC-01 careers admin needs a CRM administrator AND the PIN", () => {
  it("rejects the correct PIN when nobody is signed in to the CRM", async () => {
    const { res } = await pinSession();
    expect(res.status).toBe(401);
    expect(await prisma.careerAdminSession.count()).toBe(0);
  });
  it("rejects a signed-in non-admin even with the correct PIN", async () => {
    asUser(await makeUser({ role: "USER" }));
    const { res } = await pinSession();
    expect(res.status).toBe(403);
    expect(await prisma.careerAdminSession.count()).toBe(0);
  });
  it("rejects a disabled administrator", async () => {
    asUser(await makeUser({ role: "ADMIN", enabled: false }));
    expect((await pinSession()).res.status).toBe(401);
  });
  it("lets a CRM administrator with the correct PIN in, and a wrong PIN still fails", async () => {
    asUser(await makeUser({ role: "ADMIN" }));
    const bad = await careersLogin(new Request("http://app.test/api/careers/admin/login", { method: "POST", body: JSON.stringify({ pin: "000000" }) }));
    expect(bad.status).toBe(401);
    const ok = await pinSession();
    expect(ok.res.status).toBe(200);
    expect(ok.cookie).toContain("career_admin=");
  });
  it("a stolen PIN session cookie is useless once the CRM admin session is gone", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    asUser(admin);
    const { cookie } = await pinSession();
    expect((await careersStats(new Request("http://app.test/api/careers/admin/stats", { headers: { cookie } }))).status).toBe(200);
    asUser(null); // signed out of the CRM
    expect((await careersStats(new Request("http://app.test/api/careers/admin/stats", { headers: { cookie } }))).status).toBe(401);
    asUser(await makeUser({ role: "USER" }));
    expect((await careersStats(new Request("http://app.test/api/careers/admin/stats", { headers: { cookie } }))).status).toBe(403);
  });
  it("applies a global ceiling to PIN attempts regardless of IP", async () => {
    asUser(await makeUser({ role: "ADMIN" }));
    let last = 0;
    for (let i = 0; i < 41; i++) {
      const r = await careersLogin(new Request("http://app.test/api/careers/admin/login", { method: "POST", headers: { "x-forwarded-for": `7.7.${i}.1` }, body: JSON.stringify({ pin: "999999" }) }));
      last = r.status;
    }
    expect(last).toBe(429);
  });
});

describe("SEC-02 resume upload", () => {
  async function jobId() {
    const job = await prisma.careerJob.create({ data: { title: "Telesales", department: "Sales", location: "Delhi", employmentType: "Full-time", workMode: "On-site", experience: "1 year", salaryRange: "", vacancies: 1, displayOrder: 1, description: "d", responsibilities: "r", qualifications: "q", skills: "s", benefits: "", deadline: new Date(Date.now() + 864e5), status: "ACTIVE", isPublished: true } });
    return job.id;
  }
  const apply = async (jid: string, n: number, file: Buffer = PDF, name = "cv.pdf", ip = "9.9.9.9") => {
    const f = new FormData();
    const fields: Record<string, string> = { jobId: jid, fullName: "Asha Rao", email: "asha@example.test", phone: "9876543210", location: "Delhi", jobDesignation: "Telesales", qualification: "Graduate", experience: "2 years", noticePeriod: "30 days", consent: "true", submissionKey: `abcdef0123456789abcdef${String(n).padStart(4, "0")}` };
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    f.set("resume", new File([new Uint8Array(file)], name, { type: "application/pdf" }));
    return careersApply(new Request("http://app.test/api/careers/apply", { method: "POST", headers: { "x-forwarded-for": ip }, body: f }));
  };
  it("accepts a real PDF", async () => {
    const res = await apply(await jobId(), 1);
    expect(res.status).toBe(201);
    expect(await prisma.careerApplication.count()).toBe(1);
  });
  it("blocks the 6th upload within a minute from one IP (restores the original 5/min)", async () => {
    const jid = await jobId();
    const statuses: number[] = [];
    for (let i = 1; i <= 6; i++) statuses.push((await apply(jid, i)).status);
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
    expect(await prisma.careerApplication.count()).toBe(5);
    expect((await apply(jid, 7, PDF, "cv.pdf", "8.8.8.8")).status).toBe(201); // another IP is unaffected
  });
  it("rejects HTML disguised as a PDF and stores nothing", async () => {
    const res = await apply(await jobId(), 1, Buffer.from("<html><script>alert(1)</script></html>"), "cv.pdf");
    expect(res.status).toBe(400);
    expect(await prisma.careerApplication.count()).toBe(0);
  });
});

describe("SEC-05 blog comments", () => {
  it("throttles bursts and rejects link spam", async () => {
    const blog = await prisma.blogPost.create({ data: { title: "T", slug: "t-1", content: "c", author: "a", published: true } });
    const post = (text: string) => postComment(new Request("http://app.test/api/blogs/comments", { method: "POST", headers: { "x-forwarded-for": "4.4.4.4" }, body: JSON.stringify({ blogId: blog.id, text }) }));
    expect((await post("first")).status).toBe(201);
    expect((await post("see http://a.test http://b.test http://c.test")).status).toBe(400);
    expect((await post("third")).status).toBe(201);
    const blocked = await post("fourth");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });
});

describe("blog image upload validates content, not the filename", () => {
  const send = (file: Buffer, name: string, type: string) => {
    const f = new FormData();
    f.set("title", "Hello"); f.set("content", "Body"); f.set("author", "Admin");
    f.set("media", new File([new Uint8Array(file)], name, { type }));
    return postBlog(new Request("http://app.test/api/blogs/post-blogs", { method: "POST", body: f }));
  };
  it("requires an administrator", async () => {
    expect((await send(PNG, "a.png", "image/png")).status).toBe(401);
    asUser(await makeUser({ role: "USER" }));
    expect((await send(PNG, "a.png", "image/png")).status).toBe(403);
  });
  it("rejects HTML named .png with an image MIME type, and SVG/GIF", async () => {
    asUser(await makeUser({ role: "ADMIN" }));
    expect((await send(Buffer.from("<html>x</html>"), "a.png", "image/png")).status).toBe(400);
    expect((await send(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "a.png", "image/png")).status).toBe(400);
    expect((await send(Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(40)]), "a.png", "image/png")).status).toBe(400);
    expect(await prisma.blogPost.count()).toBe(0);
  });
  it("stores a real PNG under a server-chosen name", async () => {
    asUser(await makeUser({ role: "ADMIN" }));
    const res = await send(PNG, "../../evil.php", "text/plain");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.media).toMatch(/\.png$/);
    expect(body.media).not.toContain("evil");
  });
});

describe("SEC-13 contact form IP hashing", () => {
  const send = () => sendEmail(new Request("http://app.test/api/send-email", { method: "POST", headers: { "x-forwarded-for": "3.3.3.3" }, body: JSON.stringify({ name: "A", email: "a@example.test", phone: "9", companyname: "C", message: "Hi there" }) }));
  it("refuses to run unsalted in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("IP_HASH_SALT", "");
    expect((await send()).status).toBe(503);
    expect(await prisma.contactSubmission.count()).toBe(0);
    vi.unstubAllEnvs();
  });
  it("works with a salt and stores only a hash", async () => {
    expect((await send()).status).toBe(200);
    const row = await prisma.contactSubmission.findFirstOrThrow();
    expect(row.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.ipHash).not.toContain("3.3.3.3");
  });
});

describe("2026-11-21 endpoint contract sweep (BUG_REGISTER BLOG-1, MKT-1, MKT-2)", () => {
  const raw = (url: string, body: string, headers: Record<string, string> = {}) => new Request(url, { method: "POST", headers: { "x-forwarded-for": "7.7.7.7", ...headers }, body });
  it("BLOG-1: post-blogs answers 400, not 500, to a non-multipart body", async () => {
    asUser(await makeUser({ role: "ADMIN" }));
    const res = await postBlog(raw("http://app.test/api/blogs/post-blogs", "{not json", { "content-type": "application/json" }));
    expect(res.status).toBe(400);
    expect(await prisma.blogPost.count()).toBe(0);
  });
  it("MKT-1: send-email rejects a blank or incomplete enquiry and stores nothing", async () => {
    for (const body of [{}, { name: "A", phone: "9" }, { name: " ", phone: "9", message: "Hi" }, { name: "A", phone: "9", message: "Hi", email: "not-an-email" }]) {
      expect((await sendEmail(raw("http://app.test/api/send-email", JSON.stringify(body)))).status).toBe(400);
    }
    expect(await prisma.contactSubmission.count()).toBe(0);
    expect((await sendEmail(raw("http://app.test/api/send-email", JSON.stringify({ name: "A", phone: "9", message: "Hi" })))).status).toBe(200);
  });
  it("MKT-2: malformed JSON yields 400 on both contact endpoints", async () => {
    expect((await contact(raw("http://app.test/api/contact", "{not json"))).status).toBe(400);
    expect((await sendEmail(raw("http://app.test/api/send-email", "{not json"))).status).toBe(400);
    expect(await prisma.contactSubmission.count()).toBe(0);
  });
});
