import { prisma } from "@/lib/prisma/client";
import { requireUser } from "@/lib/auth/session";
import { listImportHistory } from "@/server/imports/service";
import { ImportWizard } from "./import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportLeadsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const [jobs, users] = await Promise.all([
    listImportHistory({ id: user.id, role: user.role, name: user.name }, 50),
    isAdmin ? prisma.user.findMany({ where: { enabled: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Data operations</div>
          <h1>Import leads</h1>
          <p style={{ color: "var(--muted)" }}>Upload a CSV file to create leads in bulk.</p>
        </div>
      </div>
      <ImportWizard isAdmin={isAdmin} users={users} />
      <h2 style={{ marginTop: 24 }}>{isAdmin ? "Import history (all users)" : "My import history"}</h2>
      <section className="table-card">
        <table>
          <thead>
            <tr>
              <th>Date</th>{isAdmin && <th>User</th>}<th>File</th><th>Total</th><th>Imported</th><th>Skipped</th><th>Duplicates</th><th>Status</th><th>Report</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                {isAdmin && <td>{job.userName || "-"}</td>}
                <td>{job.fileName || "-"}</td>
                <td>{job.totalRows}</td><td>{job.imported}</td><td>{job.skipped}</td><td>{job.duplicates}</td>
                <td><span className="badge">{job.status === "COMPLETED" ? "Completed" : job.status === "FAILED" ? "Failed" : "In progress"}</span></td>
                <td><a href={`/api/lead-import/report/${job.id}`}>Download</a></td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={isAdmin ? 9 : 8}>No imports yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
