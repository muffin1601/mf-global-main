import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { STATUS_LABEL } from "@/server/vendors/fields";
import { getVendor, vendorAudit, vendorMeta } from "@/server/vendors/vendors";
import { listActivities } from "@/server/vendors/activities";
import { listAddresses, listContacts } from "@/server/vendors/contacts";
import { listDocuments } from "@/server/vendors/documents";
import { listEvaluations } from "@/server/vendors/performance";
import { listVendorProducts, searchProducts } from "@/server/vendors/products";
import { archiveAction, changeStatusAction, checkDuplicatesAction, deleteVendorAction, restoreAction, updateVendorAction } from "../actions";
import { ActionButton } from "../_components/confirm-button";
import { ModalForm } from "../_components/modal-form";
import { ActivitiesTab, AddressesTab, AuditTab, ContactsTab, DocumentsTab, OverviewTab, PerformanceTab, ProductsTab } from "../_components/profile-tabs";
import { vendorFields } from "../_components/vendor-fields";
import s from "../_components/vendors.module.css";
import { getActor, one, orNotFound, permsOf, type SP } from "../_lib";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vendor profile" };

const TABS = [
  ["overview", "Overview"], ["contacts", "Contacts"], ["addresses", "Addresses"], ["products", "Products & Pricing"],
  ["documents", "Documents"], ["activities", "Activities"], ["performance", "Performance"], ["audit", "Audit History"],
] as const;

export default async function VendorProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const actor = await getActor();
  const perms = permsOf(actor);
  const tab = TABS.find((t) => t[0] === one(sp.tab))?.[0] ?? "overview";

  const vendor = await orNotFound(() => getVendor(actor, id));
  const href = (t: string) => `/crm/vendors/${id}${t === "overview" ? "" : `?tab=${t}`}` as Route;

  let body: React.ReactNode;
  switch (tab) {
    case "contacts": body = <ContactsTab vid={id} items={await listContacts(actor, id)} perms={perms} />; break;
    case "addresses": body = <AddressesTab vid={id} items={await listAddresses(actor, id)} perms={perms} />; break;
    case "products": {
      const [list, products] = await Promise.all([listVendorProducts(actor, id), perms.edit ? searchProducts(actor, "", 500) : Promise.resolve([])]);
      body = <ProductsTab vid={id} items={list.items} products={products.map((p) => ({ id: p.id, label: `${p.name ?? p.code ?? p.id}${p.code ? ` (${p.code})` : ""}` }))} perms={perms} />;
      break;
    }
    case "documents": {
      const archived = one(sp.docs) === "archived";
      body = <DocumentsTab vid={id} docs={(await listDocuments(actor, id, { status: archived ? "ARCHIVED" : "ACTIVE" })).documents} archived={archived} perms={perms} />;
      break;
    }
    case "activities": body = <ActivitiesTab vid={id} items={(await listActivities(actor, id, { limit: 100 })).items} perms={perms} actorId={actor.id} isAdmin={actor.role === "ADMIN"} />; break;
    case "performance": body = <PerformanceTab vid={id} data={await listEvaluations(actor, id)} perms={perms} />; break;
    case "audit": body = <AuditTab vid={id} data={await vendorAudit(actor, id, { page: Number(one(sp.auditPage)) || 1, limit: 25 })} />; break;
    default: body = <OverviewTab v={vendor} perms={perms} />;
  }

  const meta = perms.edit ? await vendorMeta(actor) : null;
  const bank = vendor.bank;
  const editFields = meta ? vendorFields({
    mode: "edit", categories: meta.categories, owners: meta.owners, canEditBank: perms.editBank, canArchive: perms.archive,
    d: {
      name: vendor.name, legalName: vendor.legalName, vendorType: vendor.vendorType, categoryId: vendor.categoryId, ownerId: vendor.ownerId, priority: vendor.priority,
      email: vendor.email, phone: vendor.phone, website: vendor.website, gstin: vendor.gstin, pan: vendor.pan, cin: vendor.cin, taxRegistration: vendor.taxRegistration,
      industry: vendor.industry, tags: vendor.tags, description: vendor.description, notes: vendor.notes, updatedAt: vendor.updatedAt.toISOString(),
      bank: bank.restricted ? undefined : { ...bank, currency: bank.currency, paymentTerms: bank.paymentTerms },
    },
  }) : [];
  const archived = !!vendor.archivedAt;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link href={"/crm/vendors" as Route}>Vendors</Link> / <span className={s.mono}>{vendor.vendorCode}</span></div>
          <h1>{vendor.name}</h1>
          <div className={s.toolbarGroup} style={{ marginTop: ".5rem" }}>
            <StatusBadge value={archived ? "Archived" : vendor.status}>{archived ? "Archived" : STATUS_LABEL[vendor.status] ?? vendor.status}</StatusBadge>
            <StatusBadge value={vendor.priority} dot={false}>{vendor.priority} priority</StatusBadge>
            {vendor.category ? <StatusBadge value={vendor.category.name} tone="neutral" dot={false} /> : null}
          </div>
        </div>
        <div className={s.toolbarGroup}>
          {perms.edit && !archived ? <ModalForm trigger="Edit vendor" title={`Edit ${vendor.name}`} wide fields={editFields} action={updateVendorAction.bind(null, id)} duplicateCheck={async (c) => { "use server"; return checkDuplicatesAction({ ...c, excludeId: id }); }} /> : null}
          {perms.edit && !archived ? (
            <ModalForm
              trigger="Change status" triggerClass="button secondary small" title="Change status" submitLabel="Update status"
              fields={[
                { name: "status", kind: "select", label: "New status", options: [["ACTIVE", "Active"], ["PENDING", "Pending"], ["INACTIVE", "Inactive"], ...(perms.archive ? ([["BLOCKED", "Blacklisted"]] as const) : [])], defaultValue: vendor.status === "ARCHIVED" ? "ACTIVE" : vendor.status },
                { name: "reason", kind: "textarea", label: "Reason (optional)" },
              ]}
              action={changeStatusAction.bind(null, id)}
            />
          ) : null}
          {perms.archive ? (archived
            ? <ActionButton label="Restore" className="button secondary small" action={restoreAction.bind(null, id)} />
            : <ActionButton label="Archive" className="button secondary small" confirm={`Archive ${vendor.name}? It can be restored later.`} action={archiveAction.bind(null, id)} />) : null}
          {perms.delete && archived ? (
            <ModalForm
              trigger="Delete permanently" triggerClass={`button small ${s.danger}`} title="Delete vendor permanently" submitLabel="Delete forever"
              fields={[{ kind: "section", label: `This removes ${vendor.vendorCode} and all its contacts, pricing, documents, activities and evaluations. This cannot be undone.` }, { name: "confirmCode", label: `Type ${vendor.vendorCode} to confirm`, required: true, full: true }]}
              action={deleteVendorAction.bind(null, id)}
            />
          ) : null}
        </div>
      </div>

      <nav className={s.tabs} aria-label="Vendor sections">
        {TABS.map(([key, label]) => <Link key={key} href={href(key)} className={`${s.tab} ${tab === key ? s.tabActive : ""}`} aria-current={tab === key ? "page" : undefined}>{label}</Link>)}
      </nav>
      <div>{body}</div>
    </main>
  );
}
