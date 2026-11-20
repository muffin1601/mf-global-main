import { describe, expect, it } from "vitest";
import { can, crmPermissionList, hasVendorPermission, permissionsFor, vendorPermissions } from "@/lib/permissions";
import { assertCan, type Actor } from "@/server/actor";
import { COLS_SENTINEL, nextSortDir, parseTableState, tableHref } from "@/lib/table-params";
import { visibleColumns } from "@/components/ui/data-table";

describe("CRM permission catalog (pins current ADMIN/USER behaviour)", () => {
  it("grants ADMIN every capability", () => {
    expect(permissionsFor("ADMIN")).toEqual(crmPermissionList);
  });

  it("grants USER exactly the capabilities the services allow today", () => {
    expect(permissionsFor("USER").sort()).toEqual([
      "leads.create", "leads.edit", "leads.export", "leads.import", "leads.view_own",
      "products.view", "quotations.create", "quotations.edit", "reports.export", "reports.view",
    ]);
  });

  it("never grants USER an admin-only capability", () => {
    for (const p of ["leads.view_all", "leads.assign", "leads.delete", "leads.bulk_update", "leads.import_assign", "quotations.view_all", "quotations.delete",
      "products.manage", "reports.view_all", "users.manage", "audit.view", "settings.manage", "dashboard.view_org"] as const) {
      expect(can("USER", p), p).toBe(false);
    }
  });

  it("denies unknown roles", () => {
    expect(can("AUDITOR" as never, "leads.view_own")).toBe(false);
  });

  it("assertCan throws a 403 HttpError when the capability is missing", () => {
    const user: Actor = { id: "u", role: "USER", name: "U" };
    expect(() => assertCan(user, "leads.view_own")).not.toThrow();
    expect(() => assertCan(user, "users.manage")).toThrow(expect.objectContaining({ status: 403 }));
  });

  it("leaves vendor permissions unchanged", () => {
    expect(vendorPermissions.filter((p) => hasVendorPermission("USER", p))).toEqual(["vendor.view", "vendor.create", "vendor.edit", "vendor.export", "vendor.documents"]);
    expect(vendorPermissions.every((p) => hasVendorPermission("ADMIN", p))).toBe(true);
  });
});

describe("table URL state", () => {
  const opts = { sortKeys: ["occurredAt", "name"], defaultSort: "occurredAt", defaultDir: "desc" as const, pageSizes: [25, 50, 100] };

  it("falls back to safe defaults for missing or invalid params", () => {
    expect(parseTableState({}, opts)).toEqual({ sort: "occurredAt", dir: "desc", page: 1, pageSize: 25, cols: null, density: "comfortable" });
    expect(parseTableState({ sort: "drop table", dir: "sideways", size: "9999", page: "-3", density: "huge" }, opts))
      .toEqual({ sort: "occurredAt", dir: "desc", page: 1, pageSize: 25, cols: null, density: "comfortable" });
  });

  it("parses valid params, repeated and comma-separated cols, and the empty-selection sentinel", () => {
    const s = parseTableState({ sort: "name", dir: "asc", size: "50", page: "3", cols: ["a", "b,c"], density: "compact" }, opts);
    expect(s).toEqual({ sort: "name", dir: "asc", page: 3, pageSize: 50, cols: ["a", "b", "c"], density: "compact" });
    expect(parseTableState({ cols: COLS_SENTINEL }, opts).cols).toEqual([]);
  });

  it("builds hrefs that keep existing filters and drop cleared keys", () => {
    expect(tableHref("/crm/x", { q: "acme", user: ["1", "2"], page: "4" }, { page: undefined, sort: "name" })).toBe("/crm/x?q=acme&user=1&user=2&sort=name");
    expect(tableHref("/crm/x", {}, {})).toBe("/crm/x");
  });

  it("flips direction on the active column and starts new columns at their first direction", () => {
    expect(nextSortDir({ sort: "name", dir: "asc" }, "name")).toBe("desc");
    expect(nextSortDir({ sort: "name", dir: "desc" }, "name")).toBe("asc");
    expect(nextSortDir({ sort: "name", dir: "asc" }, "occurredAt", "desc")).toBe("desc");
  });

  it("always shows required columns and honours defaults/hidden selections", () => {
    const cols = [
      { id: "a", header: "A", required: true, cell: () => null },
      { id: "b", header: "B", cell: () => null },
      { id: "c", header: "C", defaultHidden: true, cell: () => null },
    ];
    expect(visibleColumns(cols, null).map((c) => c.id)).toEqual(["a", "b"]);
    expect(visibleColumns(cols, ["c"]).map((c) => c.id)).toEqual(["a", "c"]);
    expect(visibleColumns(cols, []).map((c) => c.id)).toEqual(["a"]);
  });
});

describe("listActivity sort direction", () => {
  it("defaults to newest first and supports oldest first", async () => {
    const { resetDb, makeUser, actorOf, prisma } = await import("./helpers/db");
    const { listActivity } = await import("@/server/activity/service");
    await resetDb();
    const admin = await makeUser({ role: "ADMIN" });
    const base = Date.UTC(2026, 10, 1);
    for (const [i, action] of ["a.first", "b.second", "c.third"].entries()) {
      await prisma.activityLog.create({ data: { userId: admin.id, action, occurredAt: new Date(base + i * 60_000) } });
    }
    const actor = actorOf(admin);
    expect((await listActivity(actor)).items.map((r) => r.action)).toEqual(["c.third", "b.second", "a.first"]);
    expect((await listActivity(actor, { sortDir: "asc" })).items.map((r) => r.action)).toEqual(["a.first", "b.second", "c.third"]);
    expect((await listActivity(actor, { sortDir: "asc", pageSize: 2, page: 2 })).items.map((r) => r.action)).toEqual(["c.third"]);
  });
});

describe("data exports are audited (§19)", () => {
  it("lead and lead-insertion exports write one metadata-only audit row each, scoped to the caller", async () => {
    const { resetDb, makeUser, makeLead, actorOf, prisma } = await import("./helpers/db");
    const { exportLeads } = await import("@/server/leads/export");
    const { exportLeadInsertion } = await import("@/server/reports/lead-insertion-export");
    await resetDb();
    const user = await makeUser({ role: "USER", name: "Exporter" });
    await makeLead({ name: "Visible", phone: "9111111111" }, [{ userId: user.id }]);
    await makeLead({ name: "Not mine", phone: "9222222222" });
    const actor = actorOf(user);

    const out = await exportLeads(actor, { format: "csv", preset: "mine", filter: { q: "vis" } });
    expect(out.rows).toBe(1);
    const leadLog = await prisma.activityLog.findFirstOrThrow({ where: { action: "lead.exported" } });
    expect(leadLog).toMatchObject({ userId: user.id, actorName: "Exporter", actorRole: "USER" });
    expect(leadLog.details).toMatchObject({ format: "csv", rows: 1, truncated: false, preset: "mine", filter: { q: "vis" } });
    expect(JSON.stringify(leadLog.details)).not.toContain("9111111111"); // no exported data in the audit row

    const today = new Date().toISOString().slice(0, 10);
    const report = await exportLeadInsertion(actor, { from: today, to: today } as never, "csv");
    const reportLog = await prisma.activityLog.findFirstOrThrow({ where: { action: "report.lead_insertion.exported" } });
    expect(reportLog.details).toMatchObject({ format: "csv", rows: report.rowCount });
    expect(await prisma.activityLog.count()).toBe(2);
  });
});
