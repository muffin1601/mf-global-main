// Seeds SYNTHETIC data into the disposable E2E database. Refuses to run against anything but 127.0.0.1.
// Writes the matching fake-auth users file (E2E_USERS_FILE) for scripts/e2e/fake-supabase.mjs.
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../generated/prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/^postgresql:\/\/[^@]+@127\.0\.0\.1:\d+\/crm_e2e$/.test(url)) {
  throw new Error("seed.ts refuses to run: DATABASE_URL must be the local crm_e2e database on 127.0.0.1");
}
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url, max: 2 })) });

export const E2E_PASSWORD = "E2e-Test-Passw0rd!";
const people = [
  { key: "admin", name: "QA Admin", username: "qa.admin", role: "ADMIN", enabled: true },
  { key: "admin2", name: "QA Admin Two", username: "qa.admin2", role: "ADMIN", enabled: true },
  { key: "exec1", name: "QA Exec One", username: "qa.exec1", role: "USER", enabled: true },
  { key: "exec2", name: "QA Exec Two", username: "qa.exec2", role: "USER", enabled: true },
  { key: "disabled", name: "QA Disabled", username: "qa.disabled", role: "USER", enabled: false },
] as const;

async function main() {
  const authUsers: { id: string; email: string; password: string }[] = [];
  const ids: Record<string, string> = {};
  let n = 0;
  for (const p of people) {
    const authUserId = randomUUID();
    const email = `${p.username}@example.test`;
    const user = await prisma.user.create({
      data: { userId: `E2E${String(++n).padStart(3, "0")}`, name: p.name, username: p.username, email, role: p.role, enabled: p.enabled, authUserId, location: "Delhi" },
    });
    ids[p.key] = user.id;
    authUsers.push({ id: authUserId, email, password: E2E_PASSWORD });
  }

  const cats = [["CAT-PEN", "Pens"], ["CAT-BAG", "Bags"], ["CAT-MUG", "Mugs"]] as const;
  const catIds: string[] = [];
  for (const [code, name] of cats) catIds.push((await prisma.category.create({ data: { code, name } })).id);
  const productRates = [5, 12, 18, 28];
  for (let i = 1; i <= 8; i++) {
    await prisma.product.create({
      data: {
        code: `E2E-P${i}`, name: `E2E Product ${i}`, categoryId: catIds[i % 3], hsnCode: `4820${i}`, gstRate: productRates[i % 4], type: "Standard", color: "Blue",
        price: { create: { purchasePrice: 50 * i, sales5To50: 100 * i, sales50To100: 90 * i, sales100Above: 80 * i, gstRate: productRates[i % 4] } },
      },
    });
  }

  await prisma.companySettings.create({
    data: { key: "default", companyName: "E2E Test Co", address: "1 Test Street, Delhi", gst: "07AAAAA0000A1Z5", pan: "AAAAA0000A", bankDetails: { bankName: "Test Bank", accountNumber: "000000000000", ifsc: "TEST0000001" }, invoicePrefix: "E2E-INV", invoiceStart: 1, quotationPrefix: "E2E-Q" },
  });

  // Leads spread across statuses, owners, categories, locations and IST-relevant follow-up dates.
  const statuses = ["New Lead", "In Progress", "Won Lead", "Lost Lead"];
  const callStatuses = ["Not Called", "Ring", "Follow-up Required", "Converted"];
  const locs = [["Delhi", "Delhi"], ["Mumbai", "Maharashtra"], ["Pune", "Maharashtra"], ["Chennai", "Tamil Nadu"]];
  const now = Date.now();
  const day = 86_400_000;
  for (let i = 1; i <= 40; i++) {
    const [location, state] = locs[i % 4]!;
    const lead = await prisma.lead.create({
      data: {
        name: `E2E Lead ${i}`, company: `E2E Company ${i}`, email: `lead${i}@example.test`, phone: `90000${String(i).padStart(5, "0")}`,
        location, state, category: cats[i % 3]![1], dataType: i % 2 ? "B2B" : "B2C", fileName: i <= 20 ? "e2e-batch-a.csv" : "e2e-batch-b.csv",
        status: statuses[i % 4]!, callStatus: callStatuses[i % 4]!,
        followUpDate: i % 5 === 0 ? new Date(now - 2 * day) : i % 5 === 1 ? new Date(now + 60 * 60_000) : i % 5 === 2 ? new Date(now + 3 * day) : null,
        createdById: ids.admin, createdAt: new Date(now - (i % 10) * day),
      },
    });
    const owner = i % 3 === 0 ? null : i % 3 === 1 ? ids.exec1 : ids.exec2;
    if (owner) await prisma.leadAssignment.create({ data: { leadId: lead.id, userId: owner, canView: true, canUpdate: true, canDelete: false, assignedBy: ids.admin } });
  }

  await prisma.vendorCategory.create({ data: { name: "Printing" } });

  await prisma.vendor.create({ data: { vendorCode: "QA-AUDIT-1", name: "QA Layout Vendor" } });
  await prisma.blogPost.create({ data: { slug: "qa-layout", title: "Synthetic article", content: "Layout fixture" } });

  writeFileSync(process.env.E2E_USERS_FILE!, JSON.stringify(authUsers, null, 2));
  writeFileSync(process.env.E2E_IDS_FILE!, JSON.stringify(ids, null, 2));
  console.log(`seeded ${people.length} users, 40 leads, 8 products`);
}

main().finally(() => prisma.$disconnect());
