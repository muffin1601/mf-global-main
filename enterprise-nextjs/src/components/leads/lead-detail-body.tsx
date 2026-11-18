import type { Address, LeadDetail } from "@/server/leads/types";
import { dash, fmtDate, fmtDateTime } from "./format";
import styles from "./leads.module.css";

const addressText = (a: Address | null) => (a ? [a.street, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(", ") || "—" : "—");

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

/** Read-only view of every lead field; used by the View modal and the detail page. */
export function LeadDetailBody({ lead }: { lead: LeadDetail }) {
  return (
    <>
      <dl className={styles.dl}>
        <Item label="Name">{dash(lead.name)}</Item>
        <Item label="Company">{dash(lead.company)}</Item>
        <Item label="Email">{dash(lead.email)}</Item>
        <Item label="Phone">{dash([lead.countryCode, lead.phone].filter(Boolean).join(" "))}</Item>
        <Item label="Contact">{dash(lead.contact)}</Item>
        <Item label="Location">{dash(lead.location)}</Item>
        <Item label="State">{dash(lead.state)}</Item>
        <Item label="Category">{dash(lead.category)}</Item>
        <Item label="Data type">{dash(lead.dataType)}</Item>
        <Item label="File name">{dash(lead.fileName)}</Item>
        <Item label="Quantity">{dash(lead.quantity)}</Item>
        <Item label="Source">{lead.source}</Item>
        <Item label="Status"><span className="badge">{lead.status}</span></Item>
        <Item label="Call status">{lead.callStatus}</Item>
        <Item label="Calling date">{fmtDate(lead.callingDate)}</Item>
        <Item label="Entry date">{fmtDateTime(lead.createdAt)}</Item>
        <Item label="Requirements">{dash(lead.requirements)}</Item>
        <Item label="Remarks">{dash(lead.remarks)}</Item>
        <Item label="Address">{dash(lead.address)}</Item>
        <Item label="Inquiry date">{dash(lead.inquiryDate)}</Item>
      </dl>

      <h3 className={styles.section}>Follow-up dates</h3>
      <dl className={styles.dl}>
        <Item label="Next follow-up">{fmtDate(lead.followUpDate)}</Item>
        <Item label="Slot 1">{fmtDate(lead.followUps.one)}</Item>
        <Item label="Slot 2">{fmtDate(lead.followUps.two)}</Item>
        <Item label="Slot 3">{fmtDate(lead.followUps.three)}</Item>
      </dl>

      <h3 className={styles.section}>Addresses</h3>
      <dl className={styles.dl}>
        <Item label="Billing address">{addressText(lead.billingAddress)}</Item>
        <Item label="Shipping address">{addressText(lead.shippingAddress)}</Item>
      </dl>

      <h3 className={styles.section}>Additional contacts</h3>
      {lead.additionalContacts.length ? (
        <table className={styles.miniTable}>
          <thead><tr><th>Name</th><th>Contact</th><th>Details</th></tr></thead>
          <tbody>{lead.additionalContacts.map((c, i) => <tr key={i}><td>{dash(c.name)}</td><td>{c.contact}</td><td>{dash(c.details)}</td></tr>)}</tbody>
        </table>
      ) : <p className={styles.muted}>No additional contacts.</p>}

      <h3 className={styles.section}>Assigned to</h3>
      {lead.assignees.length ? (
        <table className={styles.miniTable}>
          <thead><tr><th>User</th><th>Access</th><th>Assigned</th></tr></thead>
          <tbody>{lead.assignees.map((a) => <tr key={a.userId}><td>{a.name}</td><td>{a.canUpdate ? "View + update" : "View only"}</td><td>{fmtDate(lead.assignedAtByUser[a.userId])}</td></tr>)}</tbody>
        </table>
      ) : <p className={styles.muted}>Unassigned.</p>}

      <h3 className={styles.section}>Status history</h3>
      {lead.history.length ? (
        <table className={styles.miniTable}>
          <thead><tr><th>When</th><th>Status</th><th>Call status</th><th>By</th></tr></thead>
          <tbody>
            {lead.history.map((h) => (
              <tr key={h.id}>
                <td>{fmtDateTime(h.changedAt)}</td>
                <td>{h.fromStatus ? `${h.fromStatus} → ` : ""}{h.toStatus}</td>
                <td>{h.fromCallStatus ? `${h.fromCallStatus} → ` : ""}{dash(h.toCallStatus)}</td>
                <td>{dash(h.changedByName)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className={styles.muted}>No status changes recorded.</p>}
    </>
  );
}
