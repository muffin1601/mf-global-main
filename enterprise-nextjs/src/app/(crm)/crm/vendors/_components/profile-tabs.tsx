import Link from "next/link";
import type { Route } from "next";
import { ACTIVITY_TYPES, ADDRESS_TYPES, CURRENCIES, DOCUMENT_TYPES, EVAL_CRITERIA, EVAL_LABELS, STATUS_LABEL } from "@/server/vendors/fields";
import type { getVendor } from "@/server/vendors/vendors";
import type { vendorAudit } from "@/server/vendors/vendors";
import type { listContacts, listAddresses } from "@/server/vendors/contacts";
import type { listVendorProducts } from "@/server/vendors/products";
import type { listDocuments } from "@/server/vendors/documents";
import type { listActivities } from "@/server/vendors/activities";
import type { listEvaluations } from "@/server/vendors/performance";
import {
  addActivityAction, addAddressAction, addContactAction, addEvaluationAction, addProductAction, archiveDocumentAction, deleteActivityAction, deleteAddressAction,
  deleteContactAction, deleteDocumentAction, deleteEvaluationAction, deleteProductAction, primaryAddressAction, primaryContactAction, updateActivityAction,
  updateAddressAction, updateContactAction, updateDocumentAction, updateProductAction,
} from "../actions";
import { dateInput, fmtDate, fmtDateTime, type Perms } from "../_lib";
import { ActionButton } from "./confirm-button";
import { ModalForm, type Field } from "./modal-form";
import s from "./vendors.module.css";
import { StatusBadge } from "@/components/ui/status-badge";

type Vendor = Awaited<ReturnType<typeof getVendor>>;
const dash = (v: unknown) => (v === null || v === undefined || v === "" ? "-" : String(v));
const sel = (list: readonly string[]) => list.map((v) => [v, v] as const);
const rating = [["1", "1 - Poor"], ["2", "2"], ["3", "3 - Average"], ["4", "4"], ["5", "5 - Excellent"]] as const;
const Empty = ({ children }: { children: React.ReactNode }) => <div className={s.empty}>{children}</div>;

/* --------------------------------------------------------------- overview */
export function OverviewTab({ v, perms }: { v: Vendor; perms: Perms }) {
  const rows: [string, React.ReactNode][] = [
    ["Legal name", dash(v.legalName)], ["Vendor type", dash(v.vendorType)], ["Industry", dash(v.industry)], ["Category", dash(v.category?.name)], ["Owner", dash(v.owner?.name)],
    ["Priority", v.priority], ["Email", dash(v.email)], ["Phone", dash(v.phone)], ["Website", v.website ? <a className={s.linkBtn} href={v.website} target="_blank" rel="noopener noreferrer">{v.website}</a> : "-"],
    ["GSTIN", dash(v.gstin)], ["PAN", dash(v.pan)], ["CIN", dash(v.cin)], ["Other tax registration", dash(v.taxRegistration)],
    ["Tags", v.tags.length ? v.tags.join(", ") : "-"], ["Created", `${fmtDate(v.createdAt)}${v.createdBy ? ` by ${v.createdBy.name}` : ""}`], ["Last updated", fmtDateTime(v.updatedAt)], ["Last activity", fmtDate(v.lastActivityAt)],
  ];
  const bank = v.bank;
  return (
    <>
      <div className={s.panel}>
        <h3>Vendor details</h3>
        <dl className={s.defs}>{rows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}</dl>
        {v.description ? <p style={{ marginTop: "1rem" }}>{v.description}</p> : null}
        {v.notes ? <p className={s.muted}>Notes: {v.notes}</p> : null}
      </div>
      <div className={s.panel}>
        <h3>Banking and payment</h3>
        {bank.restricted ? (
          <>
            <p className={s.muted}>Bank account details are restricted to administrators.</p>
            <dl className={s.defs}><div><dt>Currency</dt><dd>{dash(bank.currency)}</dd></div><div><dt>Payment terms</dt><dd>{dash(bank.paymentTerms)}</dd></div><div><dt>Credit period</dt><dd>{bank.creditPeriodDays == null ? "-" : `${bank.creditPeriodDays} days`}</dd></div></dl>
          </>
        ) : (
          <dl className={s.defs}>
            <div><dt>Bank</dt><dd>{dash(bank.bankName)}</dd></div><div><dt>Account holder</dt><dd>{dash(bank.accountHolderName)}</dd></div>
            <div><dt>Account number</dt><dd className={s.mono}>{bank.hasAccountNumber ? bank.accountNumberMasked : "-"}</dd></div><div><dt>IFSC</dt><dd>{dash(bank.ifsc)}</dd></div>
            <div><dt>Branch</dt><dd>{dash(bank.branch)}</dd></div><div><dt>UPI</dt><dd>{dash(bank.upi)}</dd></div>
            <div><dt>Currency</dt><dd>{dash(bank.currency)}</dd></div><div><dt>Payment terms</dt><dd>{dash(bank.paymentTerms)}</dd></div>
            <div><dt>Credit period</dt><dd>{bank.creditPeriodDays == null || bank.creditPeriodDays === "" ? "-" : `${bank.creditPeriodDays} days`}</dd></div><div><dt>Preferred method</dt><dd>{dash(bank.preferredPaymentMethod)}</dd></div>
          </dl>
        )}
        {!perms.editBank ? null : <p className={s.help}>Use Edit to change bank details. The account number is never shown in full.</p>}
      </div>
      <div className={s.panel}>
        <h3>At a glance</h3>
        <dl className={s.defs}>
          <div><dt>Status</dt><dd>{v.archivedAt ? "Archived" : STATUS_LABEL[v.status] ?? v.status}</dd></div>
          <div><dt>Rating</dt><dd>{v.performanceScore == null ? "No data" : `${v.performanceScore.toFixed(2)} (${v.performanceBand})`}</dd></div>
          <div><dt>Products</dt><dd>{v.counts.products}</dd></div><div><dt>Documents</dt><dd>{v.counts.documents}</dd></div>
          <div><dt>Contacts</dt><dd>{v.counts.contacts}</dd></div><div><dt>Addresses</dt><dd>{v.counts.addresses}</dd></div>
          <div><dt>Activities</dt><dd>{v.counts.activities}</dd></div><div><dt>Evaluations</dt><dd>{v.counts.evaluations}</dd></div>
        </dl>
      </div>
      {v.legacyData || v.customFields ? (
        <div className={s.panel}>
          <h3>Migrated legacy data</h3>
          <p className={s.help}>Original fields carried over from the previous system. Bank-related values are restricted or masked.</p>
          {v.customFields ? <><strong>Custom fields</strong><pre className={s.pre}>{JSON.stringify(v.customFields, null, 2)}</pre></> : null}
          {v.legacyData ? <><strong>Legacy record</strong><pre className={s.pre}>{JSON.stringify(v.legacyData, null, 2)}</pre></> : null}
        </div>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- contacts */
const contactFields = (c?: { name: string; designation: string | null; email: string | null; phone: string | null; isPrimary: boolean }): Field[] => [
  { name: "name", label: "Full name", required: true, defaultValue: c?.name }, { name: "designation", label: "Designation", defaultValue: c?.designation },
  { name: "email", kind: "email", label: "Email", defaultValue: c?.email }, { name: "phone", kind: "tel", label: "Phone", defaultValue: c?.phone, help: "Email or phone is required" },
  { name: "isPrimary", kind: "checkbox", label: "Primary contact", defaultValue: c?.isPrimary, full: true },
];

export function ContactsTab({ vid, items, perms }: { vid: string; items: Awaited<ReturnType<typeof listContacts>>; perms: Perms }) {
  return (
    <>
      <div className={s.toolbar}><h3 style={{ margin: 0 }}>Contacts</h3>{perms.edit ? <ModalForm trigger="Add contact" title="Add contact" fields={contactFields()} action={addContactAction.bind(null, vid)} submitLabel="Add contact" /> : null}</div>
      <section className="table-card"><div className={s.scroll}><table>
        <thead><tr><th>Name</th><th>Designation</th><th>Email</th><th>Phone</th><th /></tr></thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td><strong>{c.name}</strong> {c.isPrimary ? <StatusBadge value="Primary" tone="primary" dot={false} /> : null}</td><td>{dash(c.designation)}</td><td>{dash(c.email)}</td><td>{dash(c.phone)}</td>
              <td>{perms.edit ? <div className={s.rowActions}>
                {!c.isPrimary ? <ActionButton label="Make primary" action={primaryContactAction.bind(null, vid, c.id)} /> : null}
                <ModalForm trigger="Edit" triggerClass={s.linkBtn} title={`Edit ${c.name}`} fields={contactFields(c)} action={updateContactAction.bind(null, vid, c.id)} />
                <ActionButton label="Delete" danger confirm={`Delete contact ${c.name}?`} action={deleteContactAction.bind(null, vid, c.id)} />
              </div> : null}</td>
            </tr>
          ))}
          {items.length === 0 ? <tr><td colSpan={5}><Empty>No contacts yet.</Empty></td></tr> : null}
        </tbody>
      </table></div></section>
    </>
  );
}

/* -------------------------------------------------------------- addresses */
const addressFields = (a?: { type: string; line1: string | null; line2: string | null; city: string | null; state: string | null; postalCode: string | null; country: string | null; isPrimary: boolean }): Field[] => [
  { name: "type", kind: "select", label: "Type", options: sel(ADDRESS_TYPES), defaultValue: a?.type ?? "Registered Office" }, { name: "country", label: "Country", defaultValue: a?.country ?? "India" },
  { name: "line1", label: "Address line 1", required: true, defaultValue: a?.line1, full: true }, { name: "line2", label: "Address line 2", defaultValue: a?.line2, full: true },
  { name: "city", label: "City", defaultValue: a?.city }, { name: "state", label: "State", defaultValue: a?.state }, { name: "postalCode", label: "PIN code", defaultValue: a?.postalCode },
  { name: "isPrimary", kind: "checkbox", label: "Primary address", defaultValue: a?.isPrimary, full: true },
];

export function AddressesTab({ vid, items, perms }: { vid: string; items: Awaited<ReturnType<typeof listAddresses>>; perms: Perms }) {
  return (
    <>
      <div className={s.toolbar}><h3 style={{ margin: 0 }}>Addresses</h3>{perms.edit ? <ModalForm trigger="Add address" title="Add address" fields={addressFields()} action={addAddressAction.bind(null, vid)} submitLabel="Add address" /> : null}</div>
      <div className={s.cardsGrid}>
        {items.map((a) => (
          <div key={a.id} className={s.itemCard}>
            <h4>{a.type} {a.isPrimary ? <StatusBadge value="Primary" tone="primary" dot={false} /> : null}</h4>
            <p style={{ margin: ".25rem 0" }}>{[a.line1, a.line2].filter(Boolean).join(", ")}<br />{[a.city, a.state, a.postalCode].filter(Boolean).join(", ")}<br />{dash(a.country)}</p>
            {perms.edit ? <div className={s.rowActions} style={{ justifyContent: "flex-start" }}>
              {!a.isPrimary ? <ActionButton label="Make primary" action={primaryAddressAction.bind(null, vid, a.id)} /> : null}
              <ModalForm trigger="Edit" triggerClass={s.linkBtn} title="Edit address" fields={addressFields(a)} action={updateAddressAction.bind(null, vid, a.id)} />
              <ActionButton label="Delete" danger confirm="Delete this address?" action={deleteAddressAction.bind(null, vid, a.id)} />
            </div> : null}
          </div>
        ))}
      </div>
      {items.length === 0 ? <Empty>No addresses yet.</Empty> : null}
    </>
  );
}

/* --------------------------------------------------------------- products */
type ProductItem = Awaited<ReturnType<typeof listVendorProducts>>["items"][number];
const productFields = (products: { id: string; label: string }[] | null, p?: ProductItem): Field[] => {
  const tiers: Field[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const t = p?.priceTiers[i - 1];
    tiers.push(
      { name: `tier${i}_minQty`, kind: "number", label: `Tier ${i} min qty`, step: "any", min: 0, defaultValue: t?.minQty },
      { name: `tier${i}_maxQty`, kind: "number", label: `Tier ${i} max qty`, step: "any", min: 0, defaultValue: t?.maxQty, help: "Blank = open ended" },
      { name: `tier${i}_unitPrice`, kind: "number", label: `Tier ${i} unit price`, step: "0.01", min: 0, defaultValue: t?.unitPrice },
      { name: `tier${i}_discountPercent`, kind: "number", label: `Tier ${i} discount %`, step: "any", min: 0, max: 100, defaultValue: t?.discountPercent },
    );
  }
  return [
    ...(products ? ([{ name: "productId", kind: "select", label: "Product", required: true, options: [["", "Select a product"], ...products.map((x) => [x.id, x.label] as const)], full: true }] as Field[]) : []),
    { name: "vendorItemCode", label: "Vendor item code", defaultValue: p?.vendorItemCode }, { name: "purchasePrice", kind: "number", label: "Purchase price", required: true, step: "0.01", min: 0, defaultValue: p?.purchasePrice },
    { name: "currency", kind: "select", label: "Currency", options: sel(CURRENCIES), defaultValue: p?.currency ?? "INR" }, { name: "moq", kind: "number", label: "Min order qty", step: "any", min: 0, defaultValue: p?.moq ?? 1 },
    { name: "leadTimeDays", kind: "number", label: "Lead time (days)", min: 0, defaultValue: p?.leadTimeDays ?? 0 }, { name: "taxRate", kind: "number", label: "Tax rate %", step: "any", min: 0, max: 100, defaultValue: p?.taxRate ?? 0 },
    { name: "discountPercent", kind: "number", label: "Discount %", step: "any", min: 0, max: 100, defaultValue: p?.discountPercent ?? 0 },
    { name: "effectiveFrom", kind: "date", label: "Effective from", defaultValue: dateInput(p?.effectiveFrom) || dateInput(new Date()) }, { name: "effectiveTo", kind: "date", label: "Effective until", defaultValue: dateInput(p?.effectiveTo), help: "Blank = open ended. Windows for the same product cannot overlap." },
    { name: "notes", kind: "textarea", label: "Notes", defaultValue: p?.notes },
    { name: "isActive", kind: "checkbox", label: "Active", defaultValue: p ? p.isActive : true }, { name: "isPreferred", kind: "checkbox", label: "Preferred supplier for this product", defaultValue: p?.isPreferred },
    { kind: "section", label: "Quantity price tiers (optional, ranges must not overlap)" }, ...tiers,
  ];
};

export function ProductsTab({ vid, items, products, perms }: { vid: string; items: ProductItem[]; products: { id: string; label: string }[]; perms: Perms }) {
  return (
    <>
      <div className={s.toolbar}><h3 style={{ margin: 0 }}>Products and pricing</h3>{perms.edit ? <ModalForm trigger="Add product pricing" title="Add product pricing" wide fields={productFields(products)} action={addProductAction.bind(null, vid)} submitLabel="Add" /> : null}</div>
      <section className="table-card"><div className={s.scroll}><table>
        <thead><tr><th>Product</th><th>Item code</th><th>Price</th><th>MOQ</th><th>Lead time</th><th>Tax</th><th>Effective</th><th>Tiers</th><th /></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.product.name ?? p.product.code}</strong><div className={s.muted}>{p.product.code}</div>{p.isPreferred ? <StatusBadge value="Preferred" tone="primary" dot={false} /> : null} {!p.isActive ? <StatusBadge value="Inactive" /> : null}</td>
              <td>{dash(p.vendorItemCode)}</td><td>{p.currency} {p.purchasePrice.toFixed(2)}{p.discountPercent ? <div className={s.muted}>-{p.discountPercent}%</div> : null}</td><td>{p.moq}</td><td>{p.leadTimeDays} d</td><td>{p.taxRate}%</td>
              <td>{fmtDate(p.effectiveFrom)} to {p.effectiveTo ? fmtDate(p.effectiveTo) : "open"}</td>
              <td>{p.priceTiers.length ? p.priceTiers.map((t) => <div key={t.id}>{t.minQty}-{t.maxQty ?? "+"}: {t.unitPrice.toFixed(2)}</div>) : "-"}</td>
              <td>{perms.edit ? <div className={s.rowActions}>
                <ModalForm trigger="Edit" triggerClass={s.linkBtn} title={`Edit pricing: ${p.product.name ?? p.product.code}`} wide fields={productFields(null, p)} action={updateProductAction.bind(null, vid, p.id)} />
                <ActionButton label="Remove" danger confirm="Remove this pricing record?" action={deleteProductAction.bind(null, vid, p.id)} />
              </div> : null}</td>
            </tr>
          ))}
          {items.length === 0 ? <tr><td colSpan={9}><Empty>No products linked to this vendor.</Empty></td></tr> : null}
        </tbody>
      </table></div></section>
    </>
  );
}

/* -------------------------------------------------------------- documents */
type Doc = Awaited<ReturnType<typeof listDocuments>>["documents"][number];
const docFields = (d?: Doc): Field[] => [
  { name: "name", label: "Document name", required: true, defaultValue: d?.name }, { name: "documentType", kind: "select", label: "Type", options: sel(DOCUMENT_TYPES), defaultValue: d?.documentType ?? "Other" },
  { name: "issueDate", kind: "date", label: "Issue date", defaultValue: dateInput(d?.issueDate) }, { name: "expiryDate", kind: "date", label: "Expiry date", defaultValue: dateInput(d?.expiryDate) },
  { name: "description", kind: "textarea", label: "Description", defaultValue: d?.description },
];
const expiryBadge = (d: Doc) => d.expiryState === "expired" ? <StatusBadge value="Expired" /> : d.expiryState === "expiring" ? <StatusBadge value="Expiring" tone="warning">Expires in {d.daysToExpiry} d</StatusBadge> : d.expiryState === "valid" ? <StatusBadge value="Valid" /> : <StatusBadge value="No expiry" tone="neutral" />;
const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function DocumentsTab({ vid, docs, archived, perms }: { vid: string; docs: Doc[]; archived: boolean; perms: Perms }) {
  return (
    <>
      <div className={s.toolbar}>
        <div className={s.toolbarGroup}><h3 style={{ margin: 0 }}>{archived ? "Archived documents" : "Documents"}</h3>
          <Link className={s.linkBtn} href={`/crm/vendors/${vid}?tab=documents${archived ? "" : "&docs=archived"}` as Route}>{archived ? "Show active" : "Show archived"}</Link></div>
        {perms.documents && !archived ? <ModalForm trigger="Upload document" title="Upload document" fields={[{ name: "file", kind: "file", label: "File (PDF, image, Word, Excel)", required: true, accept: ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx", full: true }, ...docFields()]} endpoint={{ url: `/api/vendors/${vid}/documents`, method: "POST" }} submitLabel="Upload" success="Document uploaded" /> : null}
      </div>
      <section className="table-card"><div className={s.scroll}><table>
        <thead><tr><th>Document</th><th>Type</th><th>Expiry</th><th>File</th><th>Uploaded</th><th /></tr></thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td><strong>{d.name}</strong>{d.description ? <div className={s.muted}>{d.description}</div> : null}</td><td>{d.documentType}</td>
              <td>{expiryBadge(d)}{d.expiryDate ? <div className={s.muted}>{fmtDate(d.expiryDate)}</div> : null}</td>
              <td>{d.originalName}<div className={s.muted}>{size(d.sizeBytes)}</div></td><td>{fmtDate(d.createdAt)}<div className={s.muted}>{d.uploadedByName}</div></td>
              <td><div className={s.rowActions}>
                {d.canPreview ? <a className={s.linkBtn} href={`/api/vendors/${vid}/documents/${d.id}/file?disposition=inline`} target="_blank" rel="noopener noreferrer">Preview</a> : null}
                <a className={s.linkBtn} href={`/api/vendors/${vid}/documents/${d.id}/file`}>Download</a>
                {perms.documents ? <>
                  <ModalForm trigger="Replace file" triggerClass={s.linkBtn} title={`Replace file: ${d.name}`} fields={[{ name: "file", kind: "file", label: "New file", required: true, accept: ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx", full: true }]} endpoint={{ url: `/api/vendors/${vid}/documents/${d.id}/file`, method: "PUT" }} submitLabel="Replace" success="File replaced" />
                  <ModalForm trigger="Edit" triggerClass={s.linkBtn} title={`Edit ${d.name}`} fields={docFields(d)} action={updateDocumentAction.bind(null, vid, d.id)} />
                  <ActionButton label={archived ? "Restore" : "Archive"} action={archiveDocumentAction.bind(null, vid, d.id, archived ? "ACTIVE" : "ARCHIVED")} />
                  <ActionButton label="Delete" danger confirm={`Permanently delete ${d.name}?`} action={deleteDocumentAction.bind(null, vid, d.id)} />
                </> : null}
              </div></td>
            </tr>
          ))}
          {docs.length === 0 ? <tr><td colSpan={6}><Empty>No {archived ? "archived " : ""}documents.</Empty></td></tr> : null}
        </tbody>
      </table></div></section>
    </>
  );
}

/* ------------------------------------------------------------- activities */
type Act = Awaited<ReturnType<typeof listActivities>>["items"][number];
const activityFields = (a?: Act): Field[] => [
  { name: "type", kind: "select", label: "Type", options: sel(ACTIVITY_TYPES), defaultValue: a?.type ?? "Note" }, { name: "occurredAt", kind: "date", label: "Date", defaultValue: dateInput(a?.occurredAt) || dateInput(new Date()) },
  { name: "subject", label: "Subject", defaultValue: a?.subject, full: true }, { name: "description", kind: "textarea", label: "Details", required: true, defaultValue: a?.description },
];

export function ActivitiesTab({ vid, items, perms, actorId, isAdmin }: { vid: string; items: Act[]; perms: Perms; actorId: string; isAdmin: boolean }) {
  return (
    <>
      <div className={s.toolbar}><h3 style={{ margin: 0 }}>Activity timeline</h3>{perms.edit ? <ModalForm trigger="Add activity" title="Add activity" fields={activityFields()} action={addActivityAction.bind(null, vid)} submitLabel="Add activity" /> : null}</div>
      <ul className={s.timeline}>
        {items.map((a) => (
          <li key={a.id}>
            <div className={s.timelineHead}><span><StatusBadge value={a.type} tone="info" dot={false} /> {a.subject ? <strong>{a.subject}</strong> : null}</span><span>{fmtDate(a.occurredAt)} · {a.createdBy?.name ?? "Unknown"}</span></div>
            <p style={{ margin: ".5rem 0 0", whiteSpace: "pre-wrap" }}>{a.description}</p>
            {perms.edit && (isAdmin || a.createdById === actorId) ? <div className={s.rowActions} style={{ justifyContent: "flex-start", marginTop: ".5rem" }}>
              <ModalForm trigger="Edit" triggerClass={s.linkBtn} title="Edit activity" fields={activityFields(a)} action={updateActivityAction.bind(null, vid, a.id)} />
              <ActionButton label="Delete" danger confirm="Delete this activity?" action={deleteActivityAction.bind(null, vid, a.id)} />
            </div> : null}
          </li>
        ))}
      </ul>
      {items.length === 0 ? <Empty>No activity recorded yet.</Empty> : null}
    </>
  );
}

/* ------------------------------------------------------------ performance */
type Evals = Awaited<ReturnType<typeof listEvaluations>>;
export function PerformanceTab({ vid, data, perms }: { vid: string; data: Evals; perms: Perms }) {
  const evalFields: Field[] = [
    ...EVAL_CRITERIA.map((c) => ({ name: c, kind: "select" as const, label: EVAL_LABELS[c], required: true, options: [["", "Rate 1-5"], ...rating] as const })),
    { name: "periodLabel", label: "Period (e.g. Q3 2026)" }, { name: "evaluationDate", kind: "date", label: "Evaluation date", defaultValue: dateInput(new Date()) },
    { name: "comments", kind: "textarea", label: "Comments" },
  ];
  const p = data.performance;
  return (
    <>
      <div className={s.toolbar}><h3 style={{ margin: 0 }}>Performance</h3>{perms.performance ? <ModalForm trigger="Record evaluation" title="Record evaluation" fields={evalFields} action={addEvaluationAction.bind(null, vid)} submitLabel="Save evaluation" /> : null}</div>
      <div className={s.panel}>
        <dl className={s.defs}>
          <div><dt>Overall score</dt><dd><strong style={{ fontSize: "1.6rem" }}>{p.overallScore == null ? "No data" : p.overallScore.toFixed(2)}</strong> {p.overallScore == null ? null : <span className={s.stars}>({p.band})</span>}</dd></div>
          <div><dt>Evaluations</dt><dd>{p.evaluationCount}</dd></div><div><dt>Last evaluated</dt><dd>{fmtDate(p.lastEvaluatedAt)}</dd></div>
        </dl>
        {p.evaluationCount ? EVAL_CRITERIA.map((c) => {
          const val = p.criteria[c] as number | null;
          return <div key={c} className={s.critRow}><span>{EVAL_LABELS[c]}</span><div className={s.bar}><div className={s.barFill} style={{ width: `${((val ?? 0) / 5) * 100}%` }} /></div><strong>{val ?? "-"}</strong></div>;
        }) : <p className={s.muted}>No evaluations yet.</p>}
      </div>
      <section className="table-card"><div className={s.scroll}><table>
        <thead><tr><th>Date</th><th>Period</th><th>Overall</th>{EVAL_CRITERIA.map((c) => <th key={c}>{EVAL_LABELS[c]}</th>)}<th>By</th><th /></tr></thead>
        <tbody>
          {data.evaluations.map((e) => (
            <tr key={e.id as string}>
              <td>{fmtDate(e.evaluationDate as Date)}</td><td>{dash(e.periodLabel)}</td><td><strong>{(e.overallScore as number).toFixed(2)}</strong></td>
              {EVAL_CRITERIA.map((c) => <td key={c}>{e[c] as number}</td>)}<td>{dash(e.evaluatedByName)}{e.comments ? <div className={s.muted}>{e.comments as string}</div> : null}</td>
              <td>{perms.performance ? <ActionButton label="Delete" danger confirm="Delete this evaluation? The vendor score will be recalculated." action={deleteEvaluationAction.bind(null, vid, e.id as string)} /> : null}</td>
            </tr>
          ))}
          {data.evaluations.length === 0 ? <tr><td colSpan={10}><Empty>No evaluations recorded.</Empty></td></tr> : null}
        </tbody>
      </table></div></section>
    </>
  );
}

/* ------------------------------------------------------------------ audit */
type Audit = Awaited<ReturnType<typeof vendorAudit>>;
function summarize(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  const d = details as Record<string, unknown>;
  if (d.changes && typeof d.changes === "object") {
    return Object.entries(d.changes as Record<string, { from: unknown; to: unknown }>).map(([k, v]) => k === "bank" ? "bank details changed" : `${k}: ${JSON.stringify(v.from ?? "")} to ${JSON.stringify(v.to ?? "")}`).join("; ");
  }
  const skip = new Set(["module", "vendorId", "vendorCode", "name"]);
  return Object.entries(d).filter(([k]) => !skip.has(k)).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join("; ");
}

export function AuditTab({ vid, data }: { vid: string; data: Audit }) {
  return (
    <>
      <div className={s.toolbar}><h3 style={{ margin: 0 }}>Audit history</h3><span className={s.muted}>{data.total} event{data.total === 1 ? "" : "s"}</span></div>
      <section className="table-card"><div className={s.scroll}><table>
        <thead><tr><th>When</th><th>Action</th><th>By</th><th>Details</th></tr></thead>
        <tbody>
          {data.entries.map((e) => <tr key={e.id}><td>{fmtDateTime(e.occurredAt)}</td><td className={s.mono}>{e.action}</td><td>{e.actorName ?? "-"}{e.actorRole ? <div className={s.muted}>{e.actorRole.toLowerCase()}</div> : null}</td><td>{summarize(e.details) || "-"}</td></tr>)}
          {data.entries.length === 0 ? <tr><td colSpan={4}><Empty>No history yet.</Empty></td></tr> : null}
        </tbody>
      </table></div></section>
      <div className={s.pager}>
        <span>Page {data.page} of {data.pages}</span>
        <span className={s.pagerLinks}>
          {data.page > 1 ? <Link className="button secondary small" href={`/crm/vendors/${vid}?tab=audit&auditPage=${data.page - 1}` as Route}>Newer</Link> : null}
          {data.page < data.pages ? <Link className="button secondary small" href={`/crm/vendors/${vid}?tab=audit&auditPage=${data.page + 1}` as Route}>Older</Link> : null}
        </span>
      </div>
    </>
  );
}
