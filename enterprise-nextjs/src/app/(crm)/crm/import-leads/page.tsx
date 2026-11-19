import { prisma } from "@/lib/prisma/client";
import { requireUser } from "@/lib/auth/session";
import { listImportHistory } from "@/server/imports/service";
import { Download, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ImportWizard } from "./import-wizard";
import { StatusBadge } from "@/components/ui/status-badge";

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
      <PageHeader
        title="Import leads"
        description="Upload a CSV to create leads in bulk. Rows are validated and checked for duplicates before anything is saved."
        actions={<a className="button secondary" href="/api/lead-import/sample"><FileSpreadsheet size={15} aria-hidden="true" />Sample CSV</a>}
      />
      <ImportWizard isAdmin={isAdmin} users={users} />
      <section className="table-card">
        <div className="section-head"><div><h2>{isAdmin ? "Import history" : "My import history"}</h2><p>{isAdmin ? "The last 50 imports by all users." : "Your last 50 imports."} Download a report for row-level results.</p></div></div>
        <div className="table-scroll">
        <table style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>Date</th>{isAdmin && <th>User</th>}<th>File</th><th className="num">Total</th><th className="num">Imported</th><th className="num">Skipped</th><th className="num">Duplicates</th><th>Status</th><th style={{ width: 1 }}><span className="sr-only">Report</span></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{job.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</td>
                {isAdmin && <td>{job.userName || "-"}</td>}
                <td className="cell-primary">{job.fileName || "—"}</td>
                <td className="num">{job.totalRows}</td><td className="num">{job.imported}</td><td className="num">{job.skipped}</td><td className="num">{job.duplicates}</td>
                <td><StatusBadge value={job.status === "COMPLETED" ? "Completed" : job.status === "FAILED" ? "Failed" : "In progress"} /></td>
                <td><a className="button ghost small" href={`/api/lead-import/report/${job.id}`}><Download size={14} aria-hidden="true" />Report</a></td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={isAdmin ? 9 : 8} className="cell-empty">No imports yet. Your first upload will appear here.</td></tr>}
          </tbody>
        </table>
        </div>
      </section>
    </main>
  );
}
