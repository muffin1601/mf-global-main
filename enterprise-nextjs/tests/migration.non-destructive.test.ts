// DB-DEL regression: migration 20261120145700 must deactivate non-admin users, never delete them
// or their quotations. Executes the committed SQL against populated data.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { makeUser, prisma, resetDb } from "./helpers/db";

const sql = readFileSync(
  path.resolve("prisma/migrations/20261120145700_remove_non_admin_users/migration.sql"),
  "utf8",
);
const run = () => prisma.$executeRawUnsafe(sql);

beforeEach(resetDb);

describe("20261120145700_remove_non_admin_users", () => {
  it("contains no DELETE/TRUNCATE/DROP statement", () => {
    const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(code).not.toMatch(/\b(delete|truncate|drop)\b/i);
  });

  it("disables USER accounts and preserves every user, quotation and line item", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const emp = await makeUser({ role: "USER" });
    const alreadyOff = await makeUser({ role: "USER", enabled: false });
    const q = await prisma.quotation.create({
      data: { userId: emp.id, party: { name: "Acme" }, invoiceDetails: { prefix: "MF/Q/", number: "1" }, grandTotal: 236 },
    });
    await prisma.quotationItem.create({ data: { quotationId: q.id, name: "Widget", quantity: 2, price: 100 } });

    const before = { users: await prisma.user.count(), q: await prisma.quotation.count(), items: await prisma.quotationItem.count() };
    await run();

    expect(await prisma.user.count()).toBe(before.users);
    expect(await prisma.quotation.count()).toBe(before.q);
    expect(await prisma.quotationItem.count()).toBe(before.items);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: emp.id } })).enabled).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alreadyOff.id } })).enabled).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).enabled).toBe(true);
    expect((await prisma.quotation.findUniqueOrThrow({ where: { id: q.id } })).userId).toBe(emp.id);
  });

  it("is idempotent and does not touch updated_at of already-disabled users", async () => {
    const off = await makeUser({ role: "USER", enabled: false });
    const t0 = (await prisma.user.findUniqueOrThrow({ where: { id: off.id } })).updatedAt;
    await run();
    await run();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: off.id } })).updatedAt).toEqual(t0);
  });
});
