import { CalendarDays, ClipboardList, History, MapPin, Phone, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Address, LeadDetail } from "@/server/leads/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { dash, fmtDate, fmtDateTime } from "./format";
import styles from "./leads.module.css";

const addressText = (a: Address | null) => (a ? [a.street, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(", ") || "—" : "—");

function Item({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div style={wide ? { gridColumn: "1 / -1" } : undefined}><dt>{label}</dt><dd>{children}</dd></div>;
}

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section className={styles.detailSection}>
      <h3 className={styles.detailTitle}><Icon size={15} aria-hidden="true" style={{ color: "var(--text-3)" }} />{title}</h3>
      {children}
    </section>
  );
}

/** Read-only view of every lead field; used by the View dialog and the detail page. Field set is unchanged. */
export function LeadDetailBody({ lead }: { lead: LeadDetail }) {
  const phone = [lead.countryCode, lead.phone].filter(Boolean).join(" ");
  return (
    <>
      <div className={styles.detailHead}>
        <StatusBadge value={lead.status} kind="lead" />
        <StatusBadge value={lead.callStatus} kind="call" dot={false} />
        <StatusBadge value={lead.source} tone="neutral" dot={false} />
        {lead.dataType ? <StatusBadge value={lead.dataType} tone="primary" dot={false} /> : null}
      </div>

      <Section title="Contact" icon={Phone}>
        <dl className={styles.dl}>
          <Item label="Name">{dash(lead.name)}</Item>
          <Item label="Company">{dash(lead.company)}</Item>
          <Item label="Email">{lead.email ? <a className="link" href={`mailto:${lead.email}`}>{lead.email}</a> : "—"}</Item>
          <Item label="Phone">{phone ? <a className="link" href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</a> : "—"}</Item>
          <Item label="Contact">{dash(lead.contact)}</Item>
          <Item label="Address">{dash(lead.address)}</Item>
        </dl>
      </Section>

      <Section title="Classification" icon={ClipboardList}>
        <dl className={styles.dl}>
          <Item label="Category">{dash(lead.category)}</Item>
          <Item label="Data type">{dash(lead.dataType)}</Item>
          <Item label="Source">{lead.source}</Item>
          <Item label="File name">{dash(lead.fileName)}</Item>
          <Item label="Quantity">{dash(lead.quantity)}</Item>
          <Item label="Location">{dash(lead.location)}</Item>
          <Item label="State">{dash(lead.state)}</Item>
          <Item label="Requirements" wide>{dash(lead.requirements)}</Item>
          <Item label="Remarks" wide>{dash(lead.remarks)}</Item>
        </dl>
      </Section>

      <Section title="Dates and follow-ups" icon={CalendarDays}>
        <dl className={styles.dl}>
          <Item label="Entry date">{fmtDateTime(lead.createdAt)}</Item>
          <Item label="Inquiry date">{dash(lead.inquiryDate)}</Item>
          <Item label="Calling date">{fmtDate(lead.callingDate)}</Item>
          <Item label="Next follow-up"><strong>{fmtDate(lead.followUpDate)}</strong></Item>
          <Item label="Follow-up slot 1">{fmtDate(lead.followUps.one)}</Item>
          <Item label="Follow-up slot 2">{fmtDate(lead.followUps.two)}</Item>
          <Item label="Follow-up slot 3">{fmtDate(lead.followUps.three)}</Item>
        </dl>
      </Section>

      <Section title="Billing and shipping" icon={MapPin}>
        <dl className={styles.dl}>
          <Item label="Billing address">{addressText(lead.billingAddress)}</Item>
          <Item label="Shipping address">{addressText(lead.shippingAddress)}</Item>
        </dl>
      </Section>

      <Section title="Additional contacts" icon={Users}>
        {lead.additionalContacts.length ? (
          <table className={styles.miniTable}>
            <thead><tr><th>Name</th><th>Contact</th><th>Details</th></tr></thead>
            <tbody>{lead.additionalContacts.map((c, i) => <tr key={i}><td>{dash(c.name)}</td><td>{c.contact}</td><td>{dash(c.details)}</td></tr>)}</tbody>
          </table>
        ) : <p className={styles.muted}>No additional contacts.</p>}
      </Section>

      <Section title="Assigned to" icon={UserCheck}>
        {lead.assignees.length ? (
          <table className={styles.miniTable}>
            <thead><tr><th>User</th><th>Access</th><th>Assigned</th></tr></thead>
            <tbody>
              {lead.assignees.map((a) => (
                <tr key={a.userId}>
                  <td>{a.name}</td>
                  <td><StatusBadge value={a.canUpdate ? "View + update" : "View only"} tone={a.canUpdate ? "primary" : "neutral"} dot={false} /></td>
                  <td>{fmtDate(lead.assignedAtByUser[a.userId])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className={styles.muted}>Unassigned.</p>}
      </Section>

      <Section title="Status history" icon={History}>
        {lead.history.length ? (
          <ol className={styles.timeline}>
            {lead.history.map((h) => (
              <li key={h.id}>
                <span>
                  Status {h.fromStatus ? <><strong>{h.fromStatus}</strong> → </> : "set to "}<strong>{h.toStatus}</strong>
                  {h.toCallStatus ? <> · call {h.fromCallStatus ? <>{h.fromCallStatus} → </> : null}<strong>{h.toCallStatus}</strong></> : null}
                </span>
                <span className="when">{fmtDateTime(h.changedAt)}{h.changedByName ? ` · ${h.changedByName}` : ""}</span>
              </li>
            ))}
          </ol>
        ) : <p className={styles.muted}>No status changes recorded.</p>}
      </Section>
    </>
  );
}

export function LeadDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading lead" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}><span className="skeleton" style={{ width: 90, height: 20 }} /><span className="skeleton" style={{ width: 110, height: 20 }} /></div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "grid", gap: 10 }}>
          <span className="skeleton" style={{ width: 140, height: 14 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>
            {[0, 1, 2, 3].map((j) => <span key={j} className="skeleton" style={{ height: 34 }} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

