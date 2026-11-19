import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import type { Route } from "next";
import { getActor, one, permsOf, type SP } from "../_lib";
import { STATUS_LABEL, VENDOR_PRIORITIES, VENDOR_TYPES } from "@/server/vendors/fields";
import { listVendors, vendorMeta, vendorSummary, type VendorListQuery } from "@/server/vendors/vendors";
import { checkDuplicatesAction, createVendorAction } from "../actions";
import { ModalForm } from "./modal-form";
import { VendorTable, type VendorRow } from "./vendor-table";
import { vendorFields } from "./vendor-fields";
import s from "./vendors.module.css";

const PRESETS = [
  ["all", "All vendors", "/crm/vendors"],
  ["active", "Active", "/crm/vendors/active"],
  ["pending", "Pending", "/crm/vendors/pending"],
  ["inactive", "Inactive", "/crm/vendors/inactive"],
] as const;
const FILTER_KEYS = ["search", "status", "priority", "type", "category", "owner", "tag", "createdFrom", "createdTo", "archived", "sortBy", "sortDir", "limit"] as const;
const SORTS = [["createdAt", "Created"], ["name", "Name"], ["vendorCode", "Code"], ["status", "Status"], ["priority", "Priority"], ["updatedAt", "Updated"], ["lastActivityAt", "Last activity"], ["performance", "Rating"]] as const;

export async function VendorListView({ preset, searchParams }: { preset: "all" | "active" | "pending" | "inactive"; searchParams: SP }) {
  const actor = await getActor();
  const perms = permsOf(actor);
  const query: VendorListQuery = {};
  for (const k of FILTER_KEYS) { const v = one(searchParams[k]); if (v) (query as Record<string, string>)[k] = v; }
  if (preset !== "all") query.status = preset;
  query.page = Number(one(searchParams.page)) || 1;
  if (!query.limit) query.limit = 25;
  const showArchived = String(query.archived) === "true";

  const [result, summary, meta] = await Promise.all([listVendors(actor, query), vendorSummary(actor), vendorMeta(actor)]);
  const rows: VendorRow[] = result.vendors.map((v) => ({
    id: v.id, vendorCode: v.vendorCode, name: v.name, vendorType: v.vendorType, categoryName: v.category?.name ?? null, ownerName: v.owner?.name ?? null,
    status: v.status, statusLabel: STATUS_LABEL[v.status] ?? v.status, priority: v.priority, city: v.city, productCount: v.productCount,
    contactLine: v.primaryContact ? [v.primaryContact.name, v.primaryContact.phone || v.primaryContact.email].filter(Boolean).join(" · ") : v.phone || v.email || "",
    score: v.performanceScore, band: v.performanceBand, archived: !!v.archivedAt, createdAt: v.createdAt.toISOString(),
  }));

  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const k of FILTER_KEYS) { const v = one(searchParams[k]); if (v && !(preset !== "all" && k === "status")) p.set(k, v); }
    for (const [k, v] of Object.entries(extra)) { if (v === undefined || v === "") p.delete(k); else p.set(k, String(v)); }
    const t = p.toString();
    return t ? `?${t}` : "";
  };
  const base = PRESETS.find((p) => p[0] === preset)?.[2] ?? "/crm/vendors";
  const exportQuery = new URLSearchParams(Object.entries(query).filter(([k, v]) => v !== undefined && v !== "" && k !== "page" && k !== "limit").map(([k, v]) => [k, String(v)]));
  const fields = vendorFields({ mode: "create", categories: meta.categories, owners: meta.owners, canEditBank: perms.editBank, canArchive: perms.archive });

  const cards: [string, string | number][] = [
    ["Total vendors", summary.total], ["Active", summary.active], ["Pending", summary.pending], ["Inactive", summary.inactive],
    ["Documents expiring (30 days)", summary.vendorsWithExpiringDocuments], ["Added in last 30 days", summary.addedLast30Days],
    ["Requiring review", summary.requiringReview], ["Avg. lead time", summary.averageLeadTimeDays == null ? "No data" : `${summary.averageLeadTimeDays} days`],
  ];

  return (
    <main className="page">
      <PageHeader
        title={preset === "all" ? "Vendors" : `${PRESETS.find((p) => p[0] === preset)?.[1]} vendors`}
        description="Your supply network: contacts, pricing, documents and performance in one place."
        actions={<>
          {perms.import ? <Link href={"/crm/vendors/import" as Route} className="button secondary"><Upload size={15} aria-hidden="true" />Import CSV</Link> : null}
          {perms.export ? <a href={`/api/vendors/export?${exportQuery.toString()}`} className="button secondary"><Download size={15} aria-hidden="true" />Export CSV</a> : null}
          {perms.create ? <ModalForm trigger="Add vendor" triggerClass="button" title="Add vendor" wide fields={fields} action={createVendorAction} duplicateCheck={checkDuplicatesAction} submitLabel="Create vendor" /> : null}
        </>}
      />

      <section className="kpis" aria-label="Summary">
        {cards.map(([label, value]) => <div className="kpi" key={label}><span>{label}</span><strong>{typeof value === "number" ? value.toLocaleString("en-IN") : value}</strong></div>)}
      </section>

      <nav className={s.presets} aria-label="Status presets">
        {PRESETS.map(([key, label, href]) => <Link key={key} href={href as Route} className={`${s.preset} ${preset === key ? s.presetActive : ""}`} aria-current={preset === key ? "page" : undefined}>{label}</Link>)}
      </nav>

      <form className={s.filters} method="get" action={base}>
        <label className={s.wide}>Search<input type="search" name="search" defaultValue={query.search ?? ""} placeholder="Name, code, GSTIN, PAN, email, phone" /></label>
        {preset === "all" ? (
          <label>Status<select name="status" defaultValue={query.status ?? ""}><option value="">Any</option>{["ACTIVE", "PENDING", "INACTIVE", "BLOCKED"].map((v) => <option key={v} value={v}>{STATUS_LABEL[v]}</option>)}</select></label>
        ) : null}
        <label>Category<select name="category" defaultValue={query.category ?? ""}><option value="">Any</option>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Owner<select name="owner" defaultValue={query.owner ?? ""}><option value="">Any</option><option value="unassigned">Unassigned</option>{meta.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label>Priority<select name="priority" defaultValue={query.priority ?? ""}><option value="">Any</option>{VENDOR_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label>Type<select name="type" defaultValue={query.type ?? ""}><option value="">Any</option>{VENDOR_TYPES.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label>Tag<input name="tag" defaultValue={query.tag ?? ""} /></label>
        <label>Created from<input type="date" name="createdFrom" defaultValue={query.createdFrom ?? ""} /></label>
        <label>Created to<input type="date" name="createdTo" defaultValue={query.createdTo ?? ""} /></label>
        <label>Sort by<select name="sortBy" defaultValue={query.sortBy ?? "createdAt"}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Order<select name="sortDir" defaultValue={query.sortDir ?? "desc"}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
        <label>Show<select name="archived" defaultValue={showArchived ? "true" : ""}><option value="">Live vendors</option><option value="true">Archived only</option></select></label>
        <div className={s.filterActions}><button className="button" type="submit">Apply filters</button><Link className="button ghost" href={base as Route}>Reset</Link></div>
      </form>

      <VendorTable rows={rows} canEdit={perms.edit} canArchive={perms.archive} showArchived={showArchived} />

      <div className={s.pager}>
        <span>{result.total.toLocaleString("en-IN")} vendor{result.total === 1 ? "" : "s"} · page {result.page} of {Math.max(1, result.pages)}</span>
        <span className={s.pagerLinks}>
          {result.page > 1 ? <Link className="button secondary small" href={`${base}${qs({ page: result.page - 1 })}` as Route}><ChevronLeft size={14} aria-hidden="true" />Previous</Link> : null}
          {result.page < result.pages ? <Link className="button secondary small" href={`${base}${qs({ page: result.page + 1 })}` as Route}>Next<ChevronRight size={14} aria-hidden="true" /></Link> : null}
        </span>
      </div>
    </main>
  );
}
