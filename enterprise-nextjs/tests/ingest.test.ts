import { beforeEach, describe, expect, it } from "vitest";
import { createLead } from "@/server/leads/ingest";
import { actorOf, makeUser, prisma, resetDb } from "./helpers/db";
import { findExistingContacts } from "@/server/imports/service";
import { updateLead } from "@/server/leads/mutations";
import { checkDuplicate } from "@/server/leads/queries";

describe("lead ingest core", () => {
  beforeEach(resetDb);

  it("creates a lead with source, initial status, history and an activity log", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const user = await makeUser();
    const r = await createLead({ name: "Asha", phone: "9876543210", dataType: "Offline" }, { source: "MANUAL", createdById: admin.id, assignTo: [{ userId: user.id }] });
    expect(r.status).toBe("created");
    if (r.status !== "created") return;
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: r.leadId }, include: { assignments: true, statusHistory: true } });
    expect(lead).toMatchObject({ source: "MANUAL", status: "New Lead", initialStatus: "New Lead", callStatus: "Not Called", createdById: admin.id });
    expect(lead.assignments).toHaveLength(1);
    expect(lead.statusHistory).toHaveLength(1);
    expect(await prisma.activityLog.count({ where: { action: "lead.created" } })).toBe(1);
  });

  it("rejects duplicates by phone or contact (either column) and by external key", async () => {
    await createLead({ phone: "9000000001" }, { source: "MANUAL" });
    expect(await createLead({ phone: "9000000001" }, { source: "MANUAL" })).toMatchObject({ status: "duplicate", field: "phone" });
    expect(await createLead({ contact: "9000000001" }, { source: "MANUAL" })).toMatchObject({ status: "duplicate", field: "contact" });
    await createLead({ phone: "9000000002" }, { source: "INDIAMART", externalKey: "indiamart:Q9" });
    expect(await createLead({ phone: "9000000003" }, { source: "INDIAMART", externalKey: "indiamart:Q9" })).toMatchObject({ status: "duplicate", field: "externalKey" });
  });

  it("lets concurrent inserts of the same phone create exactly one lead", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => createLead({ phone: "9111111111" }, { source: "IMPORT" })));
    expect(results.filter((r) => r.status === "created")).toHaveLength(1);
    expect(await prisma.lead.count({ where: { phone: "9111111111" } })).toBe(1);
  });

  it("matches formatted legacy contacts in the preview and serializes cross-column submissions", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const legacy = await prisma.lead.create({ data: { contact: "(98111) 22233" } });
    const other = await prisma.lead.create({ data: { phone: "9012345678" } });
    expect(await checkDuplicate(admin, { phone: "9811122233", excludeId: legacy.id })).toEqual({ exists: false });
    const imported = await findExistingContacts(["+91 98111 22233", "09811122233"], []);
    expect([...imported.phones]).toEqual(["+91 98111 22233", "09811122233"]);
    await expect(updateLead(admin, other.id, { contact: "98111-22233" })).rejects.toMatchObject({ status: 409 });
    expect(await checkDuplicate(admin, { phone: "98111-22233" })).toMatchObject({ exists: true });
    expect(await createLead({ phone: "9811122233" }, { source: "MANUAL" })).toMatchObject({ status: "duplicate" });
    const results = await Promise.all([
      createLead({ phone: "98765-44444" }, { source: "MANUAL" }),
      createLead({ contact: "(98765) 44444" }, { source: "MANUAL" }),
    ]);
    expect(results.map(result => result.status).sort()).toEqual(["created", "duplicate"]);
  });

  it("stamps createdAt from the database and ignores caller-supplied dates", async () => {
    const before = Date.now();
    const r = await createLead({ phone: "9222222222" }, { source: "MANUAL" });
    if (r.status !== "created") throw new Error("expected created");
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: r.leadId } });
    expect(Math.abs(lead.createdAt.getTime() - before)).toBeLessThan(10_000);
  });
});
