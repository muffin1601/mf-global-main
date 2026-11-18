import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { assignLeadAction, createLeadAction, deleteLeadAction, updateLeadAction } from "./actions";

export const dynamic = "force-dynamic";

const formatEntryDate = (value: Date) =>
  value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; callStatus?: string }>;
}) {
  const user = await requireUser();
  const { q = "", page = "1", status = "", callStatus = "" } = await searchParams;
  const current = Math.max(1, Number.parseInt(page, 10) || 1);
  const scope = user.role === "ADMIN"
    ? {}
    : { assignments: { some: { userId: user.id, canView: true } } };
  const where = {
    ...scope,
    ...(status ? { status } : {}),
    ...(callStatus ? { callStatus } : {}),
    ...(q ? {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { company: { contains: q, mode: "insensitive" as const } },
        { phone: { contains: q } },
        { contact: { contains: q } },
      ],
    } : {}),
  };
  const [rows, total, users] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * 25,
      take: 25,
      include: { assignments: { include: { user: { select: { id: true, name: true } } } } },
    }),
    prisma.lead.count({ where }),
    user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { enabled: true, role: "USER" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Pipeline</div>
          <h1>Lead management</h1>
          <p style={{ color: "var(--muted)" }}>{total} authorized records</p>
        </div>
        <form style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input name="q" defaultValue={q} placeholder="Search leads…" style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8 }} />
          <select name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {["New Lead", "In Progress", "Followed Up", "Won Lead", "Lost Lead"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select name="callStatus" defaultValue={callStatus}>
            <option value="">All call statuses</option>
            {["Not Called", "Ring", "Not Interested", "Available After One Month", "Follow-up Required", "Wrong Number", "Converted"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <button className="button secondary">Filter</button>
        </form>
      </div>

      <details className="card" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Add lead</summary>
        <form action={createLeadAction} className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", marginTop: 16 }}>
          {[
            ["name", "Name"], ["company", "Company"], ["email", "Email"],
            ["phone", "Phone"], ["contact", "Contact"], ["location", "Location"],
            ["state", "State"], ["category", "Category"], ["quantity", "Quantity"],
            ["requirements", "Requirements"],
          ].map(([name, label]) => (
            <div className="field" key={name}>
              <label>{label}</label>
              <input name={name} type={name === "email" ? "email" : name === "quantity" ? "number" : "text"} />
            </div>
          ))}
          <div className="field">
            <label>Source</label>
            <select name="dataType" defaultValue="">
              <option value="">Select source</option>
              {["IndiaMart", "Offline", "TradeIndia", "Exhibition", "WebPortals", "Other"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          {user.role === "ADMIN" && (
            <div className="field">
              <label>Assign to</label>
              <select name="assignedUserId" defaultValue="">
                <option value="">Unassigned</option>
                {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          )}
          <button className="button" type="submit">Create lead</button>
        </form>
      </details>

      <section className="table-card">
        <table>
          <thead>
            <tr>
              <th>Lead</th><th>Phone</th><th>Entry date</th><th>Status</th>
              <th>Call status</th><th>Assignment</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const own = row.assignments.find((assignment) => assignment.userId === user.id);
              const canEdit = user.role === "ADMIN" || own?.canUpdate;
              return (
                <tr key={row.id}>
                  <td>{row.name || "—"}<br /><small>{row.company || "—"} · {row.location || "—"}</small></td>
                  <td>{row.phone || row.contact || "—"}</td>
                  <td title={row.createdAt.toISOString()}>{formatEntryDate(row.createdAt)}</td>
                  <td><span className="badge">{row.status}</span></td>
                  <td>{row.callStatus}</td>
                  <td>{row.assignments.map((assignment) => assignment.user.name).join(", ") || "Unassigned"}</td>
                  <td>
                    <details>
                      <summary style={{ cursor: "pointer" }}>Manage</summary>
                      {canEdit && (
                        <form action={updateLeadAction} className="form-grid" style={{ minWidth: 300, paddingTop: 10 }}>
                          <input type="hidden" name="id" value={row.id} />
                          <input name="name" defaultValue={row.name || ""} placeholder="Name" />
                          <input name="location" defaultValue={row.location || ""} placeholder="Location" />
                          <input name="category" defaultValue={row.category || ""} placeholder="Category" />
                          <textarea name="requirements" defaultValue={row.requirements || ""} placeholder="Requirements" />
                          <textarea name="remarks" defaultValue={row.remarks || ""} placeholder="Remarks" />
                          <select name="status" defaultValue={row.status}>
                            {["New Lead", "In Progress", "Followed Up", "Won Lead", "Lost Lead"].map((item) => <option key={item}>{item}</option>)}
                          </select>
                          <select name="callStatus" defaultValue={row.callStatus}>
                            {["Not Called", "Ring", "Not Interested", "Available After One Month", "Follow-up Required", "Wrong Number", "Converted"].map((item) => <option key={item}>{item}</option>)}
                          </select>
                          <input name="followUpDate" type="date" defaultValue={row.followUpDate?.toISOString().slice(0, 10) || ""} />
                          <button className="button" type="submit">Save changes</button>
                        </form>
                      )}
                      {user.role === "ADMIN" && (
                        <>
                          <form action={assignLeadAction} className="form-grid" style={{ marginTop: 10 }}>
                            <input type="hidden" name="leadId" value={row.id} />
                            <select name="userId" defaultValue={row.assignments[0]?.userId || ""}>
                              <option value="">Unassigned</option>
                              {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                            <label><input type="checkbox" name="canUpdate" defaultChecked={row.assignments[0]?.canUpdate} /> May update</label>
                            <label><input type="checkbox" name="canDelete" defaultChecked={row.assignments[0]?.canDelete} /> May delete</label>
                            <button className="button secondary" type="submit">Apply assignment</button>
                          </form>
                          <form action={deleteLeadAction} style={{ marginTop: 10 }}>
                            <input type="hidden" name="id" value={row.id} />
                            <button className="button secondary" type="submit">Delete lead</button>
                          </form>
                        </>
                      )}
                    </details>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7}>No leads match this view.</td></tr>}
          </tbody>
        </table>
      </section>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>Page {current} of {Math.max(1, Math.ceil(total / 25))}</p>
    </main>
  );
}
