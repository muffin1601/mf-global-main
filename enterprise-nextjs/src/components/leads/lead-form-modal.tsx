"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addContactAction, checkDuplicateAction, createLeadAction, deleteContactAction, updateLeadAction,
  type AddressValues, type LeadFormValues,
} from "@/app/(crm)/crm/lead-management/actions";
import { CALL_STATUSES, DATA_TYPES, LEAD_STATUSES } from "@/lib/crm/constants";
import { istDateString } from "@/lib/time/ist";
import type { Address, LeadDetail } from "@/server/leads/types";
import { fmtDate } from "./format";
import styles from "./leads.module.css";
import { Modal } from "./modal";
import { useLeadDetail } from "./use-lead-detail";

export type UserOption = { id: string; name: string };

const emptyAddress: AddressValues = { street: "", city: "", state: "", postalCode: "", country: "" };
const blank: LeadFormValues = {
  name: "", company: "", email: "", countryCode: "", phone: "", contact: "", location: "", state: "", category: "", dataType: "", quantity: "",
  requirements: "", remarks: "", address: "", status: "New Lead", callStatus: "Not Called", followUpDate: "", callingDate: "",
  billing: emptyAddress, shipping: emptyAddress, assignedUserId: "",
};
const addr = (a: Address | null): AddressValues => ({ ...emptyAddress, ...(a ?? {}) });
const dateValue = (iso: string | null) => (iso ? istDateString(new Date(iso)) : "");

function fromDetail(l: LeadDetail): LeadFormValues {
  return {
    name: l.name ?? "", company: l.company ?? "", email: l.email ?? "", countryCode: l.countryCode ?? "", phone: l.phone ?? "", contact: l.contact ?? "",
    location: l.location ?? "", state: l.state ?? "", category: l.category ?? "", dataType: l.dataType ?? "", quantity: l.quantity === null ? "" : String(l.quantity),
    requirements: l.requirements ?? "", remarks: l.remarks ?? "", address: l.address ?? "", status: l.status, callStatus: l.callStatus,
    followUpDate: dateValue(l.followUpDate), callingDate: dateValue(l.callingDate), billing: addr(l.billingAddress), shipping: addr(l.shippingAddress),
  };
}

type Props = { isAdmin: boolean; users: UserOption[]; onClose: () => void; onDone: () => void };

export function AddLeadModal(props: Props) {
  return <LeadFormInner {...props} mode="create" initial={blank} />;
}

export function EditLeadModal({ id, ...props }: Props & { id: string }) {
  const { lead, error, loading, reload } = useLeadDetail(id);
  if (loading || error || !lead) {
    return (
      <Modal title="Edit lead" onClose={props.onClose}>
        {error ? <p className="error">{error}</p> : <p>Loading…</p>}
      </Modal>
    );
  }
  return <LeadFormInner {...props} mode="edit" initial={fromDetail(lead)} lead={lead} reload={reload} />;
}

function LeadFormInner({ mode, initial, lead, reload, isAdmin, users, onClose, onDone }: Props & { mode: "create" | "edit"; initial: LeadFormValues; lead?: LeadDetail; reload?: () => void }) {
  const [v, setV] = useState<LeadFormValues>(initial);
  const [pending, start] = useTransition();
  const [dup, setDup] = useState<string | null>(null);
  const editing = mode === "edit";
  const identityLocked = editing && !isAdmin; // phone / company / contact are administrator-only on edit

  const set = <K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) => setV((p) => ({ ...p, [key]: value }));
  const text = (key: "name" | "company" | "email" | "countryCode" | "phone" | "contact" | "location" | "state" | "category" | "quantity" | "address") => ({
    value: v[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
  });
  const setAddr = (which: "billing" | "shipping", key: keyof AddressValues, value: string) => setV((p) => ({ ...p, [which]: { ...p[which], [key]: value } }));

  const checkDup = (field: "phone" | "contact") => {
    const value = v[field].trim();
    if (!value || (editing && value === initial[field])) { setDup(null); return; }
    checkDuplicateAction({ [field]: value, excludeId: lead?.id }).then((res) => {
      if (!res.ok) return;
      const r = res.result;
      setDup(r.exists ? `A lead with this ${field === "phone" ? "phone" : "contact"} number already exists${r.lead ? `: ${r.lead.name || "Unnamed"}${r.lead.company ? ` (${r.lead.company})` : ""}` : ""}.` : null);
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: LeadFormValues = { ...v };
    if (editing) {
      if (v.followUpDate === initial.followUpDate) delete payload.followUpDate;
      if (v.callingDate === initial.callingDate) delete payload.callingDate;
    }
    start(async () => {
      const res = editing && lead ? await updateLeadAction(lead.id, payload) : await createLeadAction(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(editing ? "Lead updated." : "Lead created.");
      onDone();
    });
  };

  return (
    <Modal
      title={editing ? "Edit lead" : "Add lead"} onClose={onClose} wide
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="lead-form" className="button" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Create lead"}</button>
        </>
      }
    >
      <form id="lead-form" onSubmit={submit} className="form-grid">
        {dup ? <div className={styles.warn} role="alert">{dup}</div> : null}
        <div className={styles.grid2}>
          <div className="field"><label htmlFor="lf-name">Name</label><input id="lf-name" {...text("name")} /></div>
          <div className="field"><label htmlFor="lf-company">Company</label><input id="lf-company" {...text("company")} disabled={identityLocked} /></div>
          <div className="field"><label htmlFor="lf-email">Email</label><input id="lf-email" type="email" {...text("email")} /></div>
          <div className="field"><label htmlFor="lf-cc">Country code</label><input id="lf-cc" {...text("countryCode")} placeholder="+91" /></div>
          <div className="field"><label htmlFor="lf-phone">Phone</label><input id="lf-phone" {...text("phone")} disabled={identityLocked} onBlur={() => checkDup("phone")} /></div>
          <div className="field"><label htmlFor="lf-contact">Contact</label><input id="lf-contact" {...text("contact")} disabled={identityLocked} onBlur={() => checkDup("contact")} /></div>
          <div className="field"><label htmlFor="lf-location">Location</label><input id="lf-location" {...text("location")} /></div>
          <div className="field"><label htmlFor="lf-state">State</label><input id="lf-state" {...text("state")} /></div>
          <div className="field"><label htmlFor="lf-category">Category</label><input id="lf-category" {...text("category")} /></div>
          <div className="field">
            <label htmlFor="lf-dt">Data type</label>
            <select id="lf-dt" value={v.dataType} onChange={(e) => set("dataType", e.target.value)}>
              <option value="">Select</option>
              {[...DATA_TYPES, ...(v.dataType && !(DATA_TYPES as readonly string[]).includes(v.dataType) ? [v.dataType] : [])].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="lf-qty">Quantity</label><input id="lf-qty" type="number" min="0" step="any" {...text("quantity")} /></div>
          <div className="field">
            <label htmlFor="lf-status">Status</label>
            <select id="lf-status" value={v.status} onChange={(e) => set("status", e.target.value)}>{LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="field">
            <label htmlFor="lf-call">Call status</label>
            <select id="lf-call" value={v.callStatus} onChange={(e) => set("callStatus", e.target.value)}>{CALL_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="field"><label htmlFor="lf-fu">Follow-up date</label><input id="lf-fu" type="date" value={v.followUpDate ?? ""} onChange={(e) => set("followUpDate", e.target.value)} /></div>
          <div className="field"><label htmlFor="lf-cd">Calling date</label><input id="lf-cd" type="date" value={v.callingDate ?? ""} onChange={(e) => set("callingDate", e.target.value)} /></div>
          {!editing && isAdmin ? (
            <div className="field">
              <label htmlFor="lf-assign">Assign to</label>
              <select id="lf-assign" value={v.assignedUserId} onChange={(e) => set("assignedUserId", e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          ) : null}
          <div className={`field ${styles.span}`}><label htmlFor="lf-addr">Address</label><input id="lf-addr" {...text("address")} /></div>
          <div className={`field ${styles.span}`}><label htmlFor="lf-req">Requirements</label><textarea id="lf-req" rows={2} value={v.requirements} onChange={(e) => set("requirements", e.target.value)} /></div>
          <div className={`field ${styles.span}`}><label htmlFor="lf-rem">Remarks</label><textarea id="lf-rem" rows={2} value={v.remarks} onChange={(e) => set("remarks", e.target.value)} /></div>
        </div>
        {identityLocked ? <p className={styles.muted}>Phone, company and contact can only be changed by an administrator.</p> : null}
        {!editing && !isAdmin ? <p className={styles.muted}>This lead will be assigned to you.</p> : null}

        {editing ? (
          <>
            <h3 className={styles.section}>Follow-up history</h3>
            <p className={styles.muted}>
              Saving a new follow-up date fills slot 1, 2 and 3 in turn, then replaces the oldest. Slots: {fmtDate(lead?.followUps.one)} · {fmtDate(lead?.followUps.two)} · {fmtDate(lead?.followUps.three)}
            </p>
            <h3 className={styles.section}>Billing address</h3>
            <AddressFields value={v.billing} onChange={(k, val) => setAddr("billing", k, val)} idp="bill" />
            <h3 className={styles.section}>Shipping address</h3>
            <AddressFields value={v.shipping} onChange={(k, val) => setAddr("shipping", k, val)} idp="ship" />
          </>
        ) : null}
      </form>
      {editing && lead && reload ? <ContactsEditor lead={lead} reload={reload} /> : null}
    </Modal>
  );
}

function AddressFields({ value, onChange, idp }: { value: AddressValues; onChange: (k: keyof AddressValues, v: string) => void; idp: string }) {
  const labels: [keyof AddressValues, string][] = [["street", "Street"], ["city", "City"], ["state", "State"], ["postalCode", "Postal code"], ["country", "Country"]];
  return (
    <div className={styles.grid2}>
      {labels.map(([k, label]) => (
        <div className="field" key={k}><label htmlFor={`${idp}-${k}`}>{label}</label><input id={`${idp}-${k}`} value={value[k]} onChange={(e) => onChange(k, e.target.value)} /></div>
      ))}
    </div>
  );
}

function ContactsEditor({ lead, reload }: { lead: LeadDetail; reload: () => void }) {
  const [name, setName] = useState(""), [contact, setContact] = useState(""), [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  const add = () => start(async () => {
    const res = await addContactAction(lead.id, { name, contact, details });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Contact added.");
    setName(""); setContact(""); setDetails("");
    reload();
  });
  const remove = (index: number) => start(async () => {
    const res = await deleteContactAction(lead.id, index);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Contact removed.");
    reload();
  });
  return (
    <>
      <h3 className={styles.section}>Additional contacts</h3>
      {lead.additionalContacts.length ? (
        <table className={styles.miniTable}>
          <tbody>
            {lead.additionalContacts.map((c, i) => (
              <tr key={i}>
                <td>{c.name || "—"}</td><td>{c.contact}</td><td>{c.details || "—"}</td>
                <td><button type="button" className={`button secondary ${styles.small} ${styles.danger}`} disabled={pending} onClick={() => remove(i)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className={styles.muted}>No additional contacts.</p>}
      <div className={styles.grid2} style={{ marginTop: ".75rem" }}>
        <div className="field"><label htmlFor="ac-name">Name</label><input id="ac-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="ac-contact">Contact</label><input id="ac-contact" value={contact} onChange={(e) => setContact(e.target.value)} /></div>
        <div className="field"><label htmlFor="ac-details">Details</label><input id="ac-details" value={details} onChange={(e) => setDetails(e.target.value)} /></div>
      </div>
      <button type="button" className={`button secondary ${styles.small}`} style={{ marginTop: ".6rem" }} disabled={pending || !contact.trim()} onClick={add}>Add contact</button>
    </>
  );
}
