import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Route handlers resolve the signed-in user through getCurrentUser; stub just that.
const state = vi.hoisted(() => ({ user: null as null | { id: string; role: "ADMIN" | "USER"; name: string; userId: string; email: string | null; enabled: boolean } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => state.user }));

import { setStorageDriverForTests } from "@/lib/storage";
import { createCategory } from "@/server/catalog/categories";
import { createProduct } from "@/server/catalog/products";
import { actorOf, makeUser, prisma, resetDb } from "./helpers/db";
import { createMemoryStorage } from "./helpers/storage";
import { GET as searchGET } from "@/app/api/products/search/route";
import { GET as listGET, POST as createPOST } from "@/app/api/products/route";
import { DELETE as archiveDELETE, PUT as updatePUT } from "@/app/api/products/[id]/route";
import { POST as categoryPOST } from "@/app/api/categories/route";

let admin: Awaited<ReturnType<typeof makeUser>>;
let regular: Awaited<ReturnType<typeof makeUser>>;
let categoryId: string;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);

const as = (u: typeof admin | null) => { state.user = u ? { id: u.id, role: u.role, name: u.name, userId: u.userId, email: u.email, enabled: u.enabled } : null; };
const url = (p: string) => `http://localhost${p}`;
const formFor = (over: Record<string, string> = {}, file?: { bytes: Buffer; name: string; type: string }) => {
  const f = new FormData();
  const base: Record<string, string> = { name: "Tote", secondaryCode: `S-${Math.random()}`, categoryId, price: JSON.stringify({ basicAmount: 100, gstRate: 18 }), ...over };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  if (file) f.set("image", new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
  return f;
};

beforeAll(() => setStorageDriverForTests(createMemoryStorage()));
beforeEach(async () => {
  await resetDb();
  admin = await makeUser({ role: "ADMIN" });
  regular = await makeUser({ role: "USER" });
  categoryId = (await createCategory(actorOf(admin), { name: "Bags" })).id;
});

describe("GET /api/products/search", () => {
  it("rejects unauthenticated callers with 401", async () => {
    as(null);
    expect((await searchGET(new Request(url("/api/products/search?query=a")))).status).toBe(401);
  });
  it("serves any signed-in role with the documented JSON shape and caps limit at 50", async () => {
    await createProduct(actorOf(admin), { name: "Tote", secondaryCode: "S1", categoryId, price: { purchasePrice: 5, basicAmount: 50, gstRate: 28 } });
    for (let i = 0; i < 60; i++) await prisma.product.create({ data: { code: `ZZ-${i}`, name: `Bulk ${i}` } });
    as(regular);
    const res = await searchGET(new Request(url("/api/products/search?query=tote&limit=10")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["products"]);
    expect(body.products[0]).toMatchObject({ code: "BA-001", name: "Tote", gstRate: 28, price: { purchasePrice: 5, basicAmount: 50, netAmount: 64 } });
    const big = await (await searchGET(new Request(url("/api/products/search?query=Bulk&limit=9999")))).json();
    expect(big.products).toHaveLength(50);
    expect((await (await searchGET(new Request(url("/api/products/search")))).json()).products).toEqual([]);
  });
  it("rejects disabled users", async () => {
    as({ ...regular, enabled: false });
    expect((await searchGET(new Request(url("/api/products/search?query=a")))).status).toBe(403);
  });
});

describe("product write routes", () => {
  it("lets admins create (multipart, image verified by content), update, archive", async () => {
    as(admin);
    const created = await createPOST(new Request(url("/api/products"), { method: "POST", body: formFor({}, { bytes: PNG, name: "x.png", type: "image/png" }) }));
    expect(created.status).toBe(201);
    const { product } = await created.json();
    expect(product.imagePath).toMatch(/product-images/);
    const upd = await updatePUT(new Request(url("/x"), { method: "PUT", body: formFor({ name: "New", secondaryCode: product.secondaryCode, expectedUpdatedAt: product.updatedAt }) }), { params: Promise.resolve({ id: product.id }) });
    expect(upd.status).toBe(200);
    const stale = await updatePUT(new Request(url("/x"), { method: "PUT", body: formFor({ name: "Stale", secondaryCode: product.secondaryCode, expectedUpdatedAt: product.updatedAt }) }), { params: Promise.resolve({ id: product.id }) });
    expect(stale.status).toBe(409);
    const arch = await archiveDELETE(new Request(url("/x"), { method: "DELETE" }), { params: Promise.resolve({ id: product.id }) });
    expect(arch.status).toBe(200);
    expect((await (await listGET(new Request(url("/api/products?status=archived")))).json()).total).toBe(1);
  });
  it("rejects an HTML file disguised as image/png with 400", async () => {
    as(admin);
    const res = await createPOST(new Request(url("/api/products"), { method: "POST", body: formFor({}, { bytes: Buffer.from("<html></html>"), name: "x.png", type: "image/png" }) }));
    expect(res.status).toBe(400);
    expect(await prisma.product.count()).toBe(0);
  });
  it("forbids non-admin writes (403) and unauthenticated writes (401)", async () => {
    as(regular);
    expect((await createPOST(new Request(url("/api/products"), { method: "POST", body: formFor() }))).status).toBe(403);
    expect((await categoryPOST(new Request(url("/api/categories"), { method: "POST", body: JSON.stringify({ name: "X" }) }))).status).toBe(403);
    expect((await archiveDELETE(new Request(url("/x"), { method: "DELETE" }), { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) })).status).toBe(403);
    as(null);
    expect((await createPOST(new Request(url("/api/products"), { method: "POST", body: formFor() }))).status).toBe(401);
    expect((await listGET(new Request(url("/api/products")))).status).toBe(401);
    expect(await prisma.product.count()).toBe(0);
  });
});
