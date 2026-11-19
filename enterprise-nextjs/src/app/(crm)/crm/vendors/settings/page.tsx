import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { vendorPermissions, hasVendorPermission } from "@/lib/permissions";
import { ACTIVITY_TYPES, ADDRESS_TYPES, CURRENCIES, DOCUMENT_TYPES, EVAL_LABELS, PAYMENT_METHODS, VENDOR_PRIORITIES, VENDOR_TYPES, STATUS_LABEL } from "@/server/vendors/fields";
import { MAX_DOCUMENT_BYTES } from "@/server/vendors/documents";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, TEMPLATE_HEADERS } from "@/server/vendors/import-export";
import s from "../_components/vendors.module.css";
import { getActor, permsOf } from "../_lib";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vendor settings" };

const DESCRIPTIONS: Record<string, string> = {
  "vendor.view": "See vendors, contacts, pricing, documents list, activities and history",
  "vendor.create": "Create vendors",
  "vendor.edit": "Edit vendors, contacts, addresses, pricing and activities; change status",
  "vendor.archive": "Archive and restore vendors; blacklist a vendor",
  "vendor.delete": "Permanently delete an archived vendor",
  "vendor.export": "Export the filtered vendor list to CSV",
  "vendor.import": "Import vendors from CSV",
  "vendor.documents": "Upload, replace, edit and delete vendor documents",
  "vendor.performance": "Record evaluations; view the performance leaderboard",
  "vendor.manage_categories": "Create, rename, deactivate and delete categories",
  "vendor.view_bank": "See masked bank details",
  "vendor.edit_bank": "Change bank and payment details",
};

export default async function VendorSettingsPage() {
  const actor = await getActor();
  const perms = permsOf(actor);
  const list = (items: readonly string[]) => items.join(", ");

  return (
    <main className="page">
      <div className="page-head"><div><div className="eyebrow">Supply network</div><h1>Vendor settings</h1></div></div>
      <p className={s.muted}>Vendor permissions follow the CRM role. You are signed in as <strong>{actor.role === "ADMIN" ? "an administrator" : "a user"}</strong>; every action is re-checked on the server.</p>

      <section className="table-card">
        <div className={s.scroll}>
          <table>
            <thead><tr><th>Permission</th><th>What it allows</th><th>Administrator</th><th>User</th><th>You</th></tr></thead>
            <tbody>
              {vendorPermissions.map((p) => (
                <tr key={p}>
                  <td className={s.mono}>{p}</td><td>{DESCRIPTIONS[p]}</td>
                  <td>{hasVendorPermission("ADMIN", p) ? "Yes" : "No"}</td><td>{hasVendorPermission("USER", p) ? "Yes" : "No"}</td>
                  <td><StatusBadge value={hasVendorPermission(actor.role, p) ? "Allowed" : "Not allowed"} tone={hasVendorPermission(actor.role, p) ? "success" : "neutral"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={s.panel}>
        <h3>Categories and import</h3>
        <div className={s.toolbarGroup}>
          <Link href={"/crm/vendors/categories" as Route} className="button secondary small">{perms.categories ? "Manage categories" : "View categories"}</Link>
          {perms.import ? <a href="/api/vendors/import/template" className="button secondary small">Download import template</a> : null}
          {perms.import ? <Link href={"/crm/vendors/import" as Route} className="button secondary small">Import vendors</Link> : null}
        </div>
        {perms.import ? <p className={s.help}>Template columns: {TEMPLATE_HEADERS.join(", ")}. Up to {(MAX_IMPORT_BYTES / 1024 / 1024).toFixed(0)} MB and {MAX_IMPORT_ROWS.toLocaleString()} rows per file.</p> : null}
      </div>

      <div className={s.panel}>
        <h3>Workflow values</h3>
        <dl className={s.defs}>
          <div><dt>Statuses</dt><dd>{list(["ACTIVE", "PENDING", "INACTIVE", "BLOCKED"].map((x) => STATUS_LABEL[x] ?? x))}</dd></div>
          <div><dt>Priorities</dt><dd>{list(VENDOR_PRIORITIES)}</dd></div>
          <div><dt>Vendor types</dt><dd>{list(VENDOR_TYPES)}</dd></div>
          <div><dt>Address types</dt><dd>{list(ADDRESS_TYPES)}</dd></div>
          <div><dt>Document types</dt><dd>{list(DOCUMENT_TYPES)}</dd></div>
          <div><dt>Activity types</dt><dd>{list(ACTIVITY_TYPES)}</dd></div>
          <div><dt>Payment methods</dt><dd>{list(PAYMENT_METHODS)}</dd></div>
          <div><dt>Currencies</dt><dd>{list(CURRENCIES)}</dd></div>
          <div><dt>Evaluation criteria (1-5)</dt><dd>{list(Object.values(EVAL_LABELS))}</dd></div>
          <div><dt>Document upload</dt><dd>PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX up to {MAX_DOCUMENT_BYTES / 1024 / 1024} MB, stored privately</dd></div>
          <div><dt>Document expiry</dt><dd>Expiring = within 30 days; expired = past the expiry date</dd></div>
          <div><dt>Vendor code</dt><dd>V + first letter of the name + 3-digit sequence (for example VA001)</dd></div>
        </dl>
      </div>
    </main>
  );
}
