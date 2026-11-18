import { beforeEach, describe, expect, it } from "vitest";
import { createLead } from "@/server/leads/ingest";
import { makeUser, prisma, resetDb } from "./helpers/db";

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

  it("stamps createdAt from the database and ignores caller-supplied dates", async () => {
    const before = Date.now();
    const r = await createLead({ phone: "9222222222" }, { source: "MANUAL" });
    if (r.status !== "created") throw new Error("expected created");
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: r.leadId } });
    expect(Math.abs(lead.createdAt.getTime() - before)).toBeLessThan(10_000);
  });
});
