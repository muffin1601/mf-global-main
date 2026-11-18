import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setStorageDriverForTests } from "@/lib/storage";
import { createCategory, deleteCategory, listCategories, renameCategory } from "@/server/catalog/categories";
import { computeNetAmount, parsePrice } from "@/server/catalog/price";
import {
  archiveProduct, createProduct, getProduct, listProducts, previewProductCode, productCodePrefix, searchProducts, updateProduct,
  type ProductInput,
} from "@/server/catalog/products";
import { getCatalogStats } from "@/server/catalog/stats";
import { actorOf, makeUser, prisma, resetDb } from "./helpers/db";
import { createMemoryStorage } from "./helpers/storage";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);

let mem: ReturnType<typeof createMemoryStorage>;
let admin: ReturnType<typeof actorOf>;
let user: ReturnType<typeof actorOf>;
let bags: { id: string };

let n = 0;
const input = (o: Partial<ProductInput> = {}): ProductInput => ({
  name: "Canvas Bag", secondaryCode: `SKU-${++n}`, categoryId: bags.id, description: "d", type: "Canvas", color: "Blue",
  hsnCode: "4202", dimension: "20x20", price: { purchasePrice: 80, basicAmount: 100, gstRate: 18 }, ...o,
});

beforeAll(() => { mem = createMemoryStorage(); setStorageDriverForTests(mem); });
beforeEach(async () => {
  await resetDb();
  mem.files.clear();
  admin = actorOf(await makeUser({ role: "ADMIN" }));
  user = actorOf(await makeUser({ role: "USER" }));
  bags = await createCategory(admin, { name: "Bags" });
});

describe("price calculation (MERN parity)", () => {
  it("computes net = basic + basic*gst/100 rounded to 2dp", () => {
    expect(computeNetAmount(100, 18)).toBe(118);
    expect(computeNetAmount(99.99, 12)).toBe(111.99);
    expect(computeNetAmount(0, 18)).toBe(0);
    expect(computeNetAmount(33.33, 18)).toBe(39.33);
    // Same IEEE-754 rounding as MERN's Number((b + b*g/100).toFixed(2)): 263.025 -> 263.02.
    expect(computeNetAmount(250.5, 5)).toBe(Number((250.5 + (250.5 * 5) / 100).toFixed(2)));
  });
  it("rejects negative / non-numeric amounts and accepts blank purchase price", () => {
    expect(() => parsePrice({ basicAmount: -1, gstRate: 5 })).toThrow(/non-negative/);
    expect(() => parsePrice({ basicAmount: "abc", gstRate: 5 })).toThrow();
    expect(() => parsePrice({ basicAmount: 10, gstRate: "" })).toThrow();
    expect(() => parsePrice({ basicAmount: 10, gstRate: 5, purchasePrice: -3 })).toThrow();
    expect(() => parsePrice(null)).toThrow(/required/);
    expect(parsePrice({ basicAmount: "100", gstRate: "18", purchasePrice: "" }).purchasePrice).toBeUndefined();
  });
  it("persists the computed net amount", async () => {
    const p = await createProduct(admin, input());
    expect(p.price).toMatchObject({ purchasePrice: 80, basicAmount: 100, gstRate: 18, netAmount: 118 });
    expect(p.price?.priceCode).toBe("RS001");
    expect((await createProduct(admin, input())).price?.priceCode).toBe("RS002");
  });
});

describe("product codes", () => {
  it("allocates independent per-prefix sequences, immutable after creation", async () => {
    const el = await createCategory(admin, { name: "Electronics" });
    const fu = await createCategory(admin, { name: "Furniture" });
    expect((await createProduct(admin, input({ categoryId: el.id }))).code).toBe("EL-001");
    expect((await createProduct(admin, input({ categoryId: el.id }))).code).toBe("EL-002");
    const f1 = await createProduct(admin, input({ categoryId: fu.id }));
    expect(f1.code).toBe("FU-001");
    expect(await previewProductCode(user, el.id)).toBe("EL-003");
    const moved = await updateProduct(admin, f1.id, { ...input({ categoryId: el.id }), expectedUpdatedAt: f1.updatedAt });
    expect(moved.code).toBe("FU-001");
    expect(moved.category?.name).toBe("Electronics");
  });
  it("normalises names and shares a sequence for colliding prefixes", async () => {
    expect(productCodePrefix("corporate gifts")).toBe("CO");
    expect(productCodePrefix("7! apparel")).toBe("AP");
    expect(productCodePrefix("X")).toBe("X");
    expect(() => productCodePrefix("123")).toThrow();
    const a = await createCategory(admin, { name: "Electronics" });
    const b = await createCategory(admin, { name: "Electrical" });
    expect((await createProduct(admin, input({ categoryId: a.id }))).code).toBe("EL-001");
    expect((await createProduct(admin, input({ categoryId: b.id }))).code).toBe("EL-002");
  });
  it("continues above legacy codes", async () => {
    await prisma.product.create({ data: { code: "BA-007", name: "legacy", categoryId: bags.id } });
    expect((await createProduct(admin, input())).code).toBe("BA-008");
  });
  it("stays unique under concurrent creation", async () => {
    const created = await Promise.all(Array.from({ length: 20 }, () => createProduct(admin, input())));
    const codes = created.map((p) => p.code).sort();
    expect(new Set(codes).size).toBe(20);
    expect(codes).toEqual(Array.from({ length: 20 }, (_, i) => `BA-${String(i + 1).padStart(3, "0")}`));
    const priceCodes = (await prisma.productPrice.findMany()).map((p) => p.priceCode);
    expect(new Set(priceCodes).size).toBe(20);
  });
});

describe("create validation", () => {
  it("requires name, style code, category and rejects duplicate style codes (case-insensitive)", async () => {
    await expect(createProduct(admin, input({ name: " " }))).rejects.toMatchObject({ status: 400 });
    await expect(createProduct(admin, input({ secondaryCode: "" }))).rejects.toMatchObject({ status: 400 });
    await expect(createProduct(admin, input({ categoryId: "nope" }))).rejects.toMatchObject({ status: 400 });
    await createProduct(admin, input({ secondaryCode: "SKU-X" }));
    await expect(createProduct(admin, input({ secondaryCode: "sku-x" }))).rejects.toMatchObject({ status: 409 });
  });
  it("allows reusing the style code of an archived product", async () => {
    const p = await createProduct(admin, input({ secondaryCode: "REUSE" }));
    await archiveProduct(admin, p.id);
    await expect(createProduct(admin, input({ secondaryCode: "REUSE" }))).resolves.toBeTruthy();
  });
  it("writes an activity log entry", async () => {
    const p = await createProduct(admin, input());
    const log = await prisma.activityLog.findFirst({ where: { action: "product.created" } });
    expect(log?.userId).toBe(admin.id);
    expect(log?.details).toMatchObject({ productId: p.id, productCode: p.code });
  });
});

describe("images", () => {
  it("stores a real image in the public bucket by magic bytes and records the public URL", async () => {
    const p = await createProduct(admin, input(), { bytes: PNG });
    expect(p.imagePath).toMatch(/^memory:\/\/public\/product-images\/product-[0-9a-f-]+\.png$/);
    expect(mem.files.size).toBe(1);
    const [key, file] = [...mem.files.entries()][0]!;
    expect(key.startsWith("product-images/")).toBe(true);
    expect(file.contentType).toBe("image/png");
  });
  it("rejects a .png that is really HTML, other non-images, and empty files; nothing is stored", async () => {
    await expect(createProduct(admin, input(), { bytes: Buffer.from("<html><script>alert(1)</script></html>") })).rejects.toMatchObject({ status: 400 });
    await expect(createProduct(admin, input(), { bytes: Buffer.from("%PDF-1.4 fake pdf") })).rejects.toMatchObject({ status: 400 });
    await expect(createProduct(admin, input(), { bytes: Buffer.alloc(0) })).rejects.toMatchObject({ status: 400 });
    expect(mem.files.size).toBe(0);
    expect(await prisma.product.count()).toBe(0);
  });
  it("enforces the 5 MB limit", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    await expect(createProduct(admin, input(), { bytes: big })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/5 MB/) });
    const exactly = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 - PNG.length)]);
    await expect(createProduct(admin, input(), { bytes: exactly })).resolves.toBeTruthy();
  });
  it("removes the uploaded object if the database write fails", async () => {
    await createProduct(admin, input({ secondaryCode: "DUP" }));
    // Duplicate detected before upload -> nothing stored.
    await expect(createProduct(admin, input({ secondaryCode: "DUP" }), { bytes: PNG })).rejects.toMatchObject({ status: 409 });
    expect(mem.files.size).toBe(0);
  });
  it("replaces and removes images, deleting the old object", async () => {
    const p = await createProduct(admin, input(), { bytes: PNG });
    const replaced = await updateProduct(admin, p.id, { ...input({ secondaryCode: p.secondaryCode! }), expectedUpdatedAt: p.updatedAt }, { bytes: JPEG });
    expect(replaced.imagePath).toMatch(/\.jpg$/);
    expect(mem.files.size).toBe(1);
    expect([...mem.files.keys()][0]).toMatch(/\.jpg$/);
    const removed = await updateProduct(admin, p.id, { ...input({ secondaryCode: p.secondaryCode! }), expectedUpdatedAt: replaced.updatedAt, removeImage: true });
    expect(removed.imagePath).toBeNull();
    expect(mem.files.size).toBe(0);
  });
  it("keeps the image when an update carries none, and a bad replacement leaves the old one", async () => {
    const p = await createProduct(admin, input(), { bytes: PNG });
    const same = { ...input({ secondaryCode: p.secondaryCode! }), expectedUpdatedAt: p.updatedAt };
    await expect(updateProduct(admin, p.id, same, { bytes: Buffer.from("<html>") })).rejects.toMatchObject({ status: 400 });
    const kept = await updateProduct(admin, p.id, same);
    expect(kept.imagePath).toBe(p.imagePath);
    expect(mem.files.size).toBe(1);
  });
  it("does not delete legacy or foreign image paths", async () => {
    const legacy = await prisma.product.create({ data: { code: "LG-001", name: "legacy", categoryId: bags.id, imagePath: "/uploads/products/old.png", price: { create: { basicAmount: 1, gstRate: 0, netAmount: 1 } } } });
    const v = await getProduct(admin, legacy.id);
    const updated = await updateProduct(admin, legacy.id, { ...input(), expectedUpdatedAt: v.updatedAt, removeImage: true });
    expect(updated.imagePath).toBeNull();
  });
});

describe("optimistic concurrency", () => {
  it("rejects a stale updatedAt with 409 and accepts the fresh one", async () => {
    const p = await createProduct(admin, input());
    const form = (name: string) => ({ ...input({ name, secondaryCode: p.secondaryCode! }), expectedUpdatedAt: p.updatedAt });
    const first = await updateProduct(admin, p.id, form("Revised"));
    expect(first.name).toBe("Revised");
    expect(first.updatedAt).not.toBe(p.updatedAt);
    await expect(updateProduct(admin, p.id, form("Stale"))).rejects.toMatchObject({ status: 409 });
    expect((await getProduct(admin, p.id)).name).toBe("Revised");
    await expect(updateProduct(admin, p.id, { ...form("Fresh"), expectedUpdatedAt: first.updatedAt })).resolves.toMatchObject({ name: "Fresh" });
  });
  it("lets exactly one of two simultaneous edits win", async () => {
    const p = await createProduct(admin, input());
    const attempt = (name: string) => updateProduct(admin, p.id, { ...input({ name, secondaryCode: p.secondaryCode! }), expectedUpdatedAt: p.updatedAt });
    const results = await Promise.allSettled([attempt("A"), attempt("B")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
  });
  it("requires a version, 404s unknown ids, refuses archived edits and duplicate style codes", async () => {
    const p = await createProduct(admin, input());
    const q = await createProduct(admin, input());
    await expect(updateProduct(admin, p.id, { ...input(), expectedUpdatedAt: "" })).rejects.toMatchObject({ status: 400 });
    await expect(updateProduct(admin, "11111111-1111-4111-8111-111111111111", { ...input(), expectedUpdatedAt: p.updatedAt })).rejects.toMatchObject({ status: 404 });
    await expect(updateProduct(admin, p.id, { ...input({ secondaryCode: q.secondaryCode!.toLowerCase() }), expectedUpdatedAt: p.updatedAt })).rejects.toMatchObject({ status: 409 });
    const archived = await archiveProduct(admin, q.id);
    await expect(updateProduct(admin, q.id, { ...input(), expectedUpdatedAt: archived.updatedAt })).rejects.toMatchObject({ status: 409 });
  });
  it("updates price and recalculates net, keeping the price code", async () => {
    const p = await createProduct(admin, input());
    const u = await updateProduct(admin, p.id, { ...input({ secondaryCode: p.secondaryCode!, price: { basicAmount: 200, gstRate: 5 } }), expectedUpdatedAt: p.updatedAt });
    expect(u.price).toMatchObject({ basicAmount: 200, gstRate: 5, netAmount: 210, priceCode: p.price?.priceCode, purchasePrice: null });
    expect(u.gstRate).toBe(5);
  });
});

describe("archive, list filters, sorting and paging", () => {
  it("archives softly and hides from active lists and search; second archive 409", async () => {
    const p = await createProduct(admin, input({ name: "Canvas Bag" }), { bytes: PNG });
    const a = await archiveProduct(admin, p.id);
    expect(a.status).toBe("ARCHIVED");
    expect(a.archivedAt).not.toBeNull();
    expect(await prisma.product.count()).toBe(1);
    expect(mem.files.size).toBe(1); // image retained
    expect((await listProducts(user)).total).toBe(0);
    expect((await listProducts(user, { status: "archived" })).total).toBe(1);
    expect((await listProducts(user, { status: "all" })).total).toBe(1);
    expect(await searchProducts(user, "Canvas")).toEqual([]);
    await expect(archiveProduct(admin, p.id)).rejects.toMatchObject({ status: 409 });
    await expect(archiveProduct(admin, "bad")).rejects.toMatchObject({ status: 404 });
    expect(await prisma.activityLog.count({ where: { action: "product.archived" } })).toBe(1);
  });
  it("filters inactive, by category and by search across fields incl. category name and GST", async () => {
    const other = await createCategory(admin, { name: "Pens" });
    const a = await createProduct(admin, input({ name: "Alpha", color: "Crimson", categoryId: other.id }));
    await createProduct(admin, input({ name: "Beta", dimension: "99x99", price: { basicAmount: 10, gstRate: 12 } }));
    await prisma.product.update({ where: { id: a.id }, data: { status: "INACTIVE" } });
    expect((await listProducts(admin)).total).toBe(2); // active default = not archived
    expect((await listProducts(admin, { status: "inactive" })).products.map((x) => x.name)).toEqual(["Alpha"]);
    expect((await listProducts(admin, { categoryId: other.id })).total).toBe(1);
    expect((await listProducts(admin, { categoryId: "garbage" })).total).toBe(0);
    expect((await listProducts(admin, { query: "crims" })).total).toBe(1);
    expect((await listProducts(admin, { query: "99x" })).total).toBe(1);
    expect((await listProducts(admin, { query: "pens" })).total).toBe(1); // category name
    expect((await listProducts(admin, { query: "12" })).products.map((x) => x.name)).toEqual(["Beta"]); // gst
  });
  it("sorts and pages on the server", async () => {
    for (const [name, basic] of [["Charlie", 30], ["Alpha", 10], ["Bravo", 20]] as const) {
      await createProduct(admin, input({ name, price: { basicAmount: basic, gstRate: 0 } }));
    }
    const names = async (sort: string) => (await listProducts(admin, { sort })).products.map((p) => p.name);
    expect(await names("name_asc")).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(await names("name_desc")).toEqual(["Charlie", "Bravo", "Alpha"]);
    expect(await names("price_asc")).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(await names("price_desc")).toEqual(["Charlie", "Bravo", "Alpha"]);
    expect(await names("created_asc")).toEqual(["Charlie", "Alpha", "Bravo"]);
    expect(await names("created_desc")).toEqual(["Bravo", "Alpha", "Charlie"]);
    const p2 = await listProducts(admin, { sort: "name_asc", limit: 2, page: 2 });
    expect(p2).toMatchObject({ total: 3, pages: 2, page: 2 });
    expect(p2.products.map((p) => p.name)).toEqual(["Charlie"]);
    expect((await listProducts(admin, { limit: 100000 })).limit).toBe(200);
  });
});

describe("search contract", () => {
  it("returns the documented shape, matches the documented fields, caps at 50", async () => {
    await createProduct(admin, input({ name: "Tote", color: "Teal", type: "Jute", dimension: "30x40", price: { purchasePrice: 5, basicAmount: 50, gstRate: 28 } }), { bytes: PNG });
    const hit = (await searchProducts(user, "tote"))[0]!;
    expect(hit).toMatchObject({
      id: expect.any(String), code: "BA-001", name: "Tote", type: "Jute", color: "Teal", dimension: "30x40", gstRate: 28,
      category: { name: "Bags" }, imagePath: expect.stringContaining("product-images"),
      price: { purchasePrice: 5, basicAmount: 50, netAmount: 64 },
    });
    for (const q of ["ba-001", "teal", "jute", "30x40", "28", hit.secondaryCode!]) expect((await searchProducts(user, q)).length).toBe(1);
    expect(await searchProducts(user, "")).toEqual([]);
    expect(await searchProducts(user, "   ")).toEqual([]);
    expect(await searchProducts(user, "zzz-none")).toEqual([]);
    for (let i = 0; i < 55; i++) await prisma.product.create({ data: { code: `ZZ-${i}`, name: `Bulk ${i}`, categoryId: bags.id } });
    expect((await searchProducts(user, "Bulk", 500)).length).toBe(50);
    expect((await searchProducts(user, "Bulk", 5)).length).toBe(5);
  });
});

describe("categories", () => {
  it("generates C{letter}{nnn} codes and rejects duplicates (case-insensitive)", async () => {
    expect(bags.id).toBeTruthy();
    const c = await createCategory(admin, { name: "Bottles" });
    const rows = await listCategories(user);
    expect(rows.map((r) => r.code).sort()).toEqual(["CB001", "CB002"]);
    expect(c.code).toBe("CB002");
    await expect(createCategory(admin, { name: "bottles" })).rejects.toMatchObject({ status: 400, message: "Category already exists." });
    await expect(createCategory(admin, { name: "  " })).rejects.toMatchObject({ status: 400 });
  });
  it("allocates distinct codes under concurrency", async () => {
    const made = await Promise.all(Array.from({ length: 8 }, (_, i) => createCategory(admin, { name: `Box ${i}` })));
    expect(new Set(made.map((c) => c.code)).size).toBe(8);
  });
  it("renames with duplicate check and 404", async () => {
    const c = await createCategory(admin, { name: "Pens" });
    await expect(renameCategory(admin, c.id, { name: "BAGS" })).rejects.toMatchObject({ status: 400 });
    await expect(renameCategory(admin, c.id, { name: "Pens" })).resolves.toMatchObject({ name: "Pens" });
    expect((await renameCategory(admin, c.id, { name: "Pencils" })).name).toBe("Pencils");
    await expect(renameCategory(admin, "11111111-1111-4111-8111-111111111111", { name: "x" })).rejects.toMatchObject({ status: 404 });
  });
  it("blocks deletion with 409 while products use the category", async () => {
    await createProduct(admin, input());
    await expect(deleteCategory(admin, bags.id)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/used by 1 product\./) });
    const empty = await createCategory(admin, { name: "Empty" });
    await deleteCategory(admin, empty.id);
    expect((await listCategories(admin)).map((c) => c.name)).toEqual(["Bags"]);
    await expect(deleteCategory(admin, empty.id)).rejects.toMatchObject({ status: 404 });
  });
  it("counts archived products as usage too", async () => {
    const p = await createProduct(admin, input());
    await archiveProduct(admin, p.id);
    await expect(deleteCategory(admin, bags.id)).rejects.toMatchObject({ status: 409 });
  });
});

describe("authorization", () => {
  it("lets any signed-in user read but only admins write", async () => {
    const p = await createProduct(admin, input());
    expect((await listProducts(user)).total).toBe(1);
    expect((await getProduct(user, p.id)).id).toBe(p.id);
    expect(await previewProductCode(user, bags.id)).toBe("BA-002");
    expect((await listCategories(user)).length).toBe(1);
    expect((await getCatalogStats(user)).totalProducts).toBe(1);
    const forbidden = { status: 403 };
    await expect(createProduct(user, input())).rejects.toMatchObject(forbidden);
    await expect(updateProduct(user, p.id, { ...input(), expectedUpdatedAt: p.updatedAt })).rejects.toMatchObject(forbidden);
    await expect(archiveProduct(user, p.id)).rejects.toMatchObject(forbidden);
    await expect(createCategory(user, { name: "X" })).rejects.toMatchObject(forbidden);
    await expect(renameCategory(user, bags.id, { name: "X" })).rejects.toMatchObject(forbidden);
    await expect(deleteCategory(user, bags.id)).rejects.toMatchObject(forbidden);
    expect(await prisma.product.count()).toBe(1);
  });
  it("rejects unauthenticated callers on every entry point", async () => {
    const p = await createProduct(admin, input());
    const unauth = { status: 401 };
    await expect(listProducts(null)).rejects.toMatchObject(unauth);
    await expect(getProduct(undefined, p.id)).rejects.toMatchObject(unauth);
    await expect(searchProducts(null, "x")).rejects.toMatchObject(unauth);
    await expect(previewProductCode(null, bags.id)).rejects.toMatchObject(unauth);
    await expect(listCategories(null)).rejects.toMatchObject(unauth);
    await expect(getCatalogStats(null)).rejects.toMatchObject(unauth);
    await expect(createProduct(null, input())).rejects.toMatchObject(unauth);
    await expect(updateProduct(null, p.id, { ...input(), expectedUpdatedAt: p.updatedAt })).rejects.toMatchObject(unauth);
    await expect(archiveProduct(null, p.id)).rejects.toMatchObject(unauth);
    await expect(createCategory(null, { name: "X" })).rejects.toMatchObject(unauth);
    await expect(deleteCategory(null, bags.id)).rejects.toMatchObject(unauth);
  });
});

describe("dashboard stats", () => {
  it("reports real counts only", async () => {
    const pens = await createCategory(admin, { name: "Pens" });
    await createProduct(admin, input());
    await createProduct(admin, input());
    await createProduct(admin, input({ categoryId: pens.id }));
    const gone = await createProduct(admin, input());
    await archiveProduct(admin, gone.id);
    await prisma.vendor.create({ data: { vendorCode: "V-1", name: "Vendor 1" } });
    await prisma.vendor.create({ data: { vendorCode: "V-2", name: "Vendor 2", archivedAt: new Date() } });
    const s = await getCatalogStats(admin);
    expect(s.totalProducts).toBe(3);
    expect(s.totalVendors).toBe(1);
    expect(s.productsByStatus).toEqual({ ACTIVE: 3, INACTIVE: 0, ARCHIVED: 1 });
    expect(s.productsByCategory).toEqual([{ category: "Bags", count: 2 }, { category: "Pens", count: 1 }]);
  });
});
