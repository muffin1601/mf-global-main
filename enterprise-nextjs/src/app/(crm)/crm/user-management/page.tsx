import { ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { prisma } from "@/lib/prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow } from "@/components/ui/empty-state";
import { AddUserButton, UserRowActions } from "./user-admin-client";

export const dynamic = "force-dynamic";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

export default async function UserManagementPage() {
  const me = await requireAdmin();
  // Only display fields are selected: no auth ids, hashes or tokens reach the page.
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, userId: true, name: true, username: true, email: true, role: true, enabled: true, location: true, authUserId: true, avatarPath: true, avatarUpdatedAt: true },
  });
  const admins = users.filter((u) => u.role === "ADMIN").length;
  const enabled = users.filter((u) => u.enabled).length;

  return (
    <main className="page">
      <PageHeader
        eyebrow="Administration"
        title="User management"
        description="Provision Supabase accounts, control access and reset passwords. Every change is written to the activity log."
        actions={<AddUserButton />}
      />
      <section className="kpis" aria-label="User totals">
        <MetricCard label="Users" value={users.length} icon={Users} />
        <MetricCard label="Administrators" value={admins} icon={ShieldCheck} tone="violet" />
        <MetricCard label="Enabled" value={enabled} icon={UserCheck} tone="success" />
        <MetricCard label="Disabled" value={users.length - enabled} icon={UserX} tone="neutral" />
      </section>
      <section className="table-card">
        <div className="table-scroll">
          <table style={{ minWidth: 820 }}>
            <thead><tr><th>User</th><th>User ID</th><th>Email</th><th>Location</th><th>Role</th><th>Account</th><th style={{ width: 1 }}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {user.avatarPath
                        // eslint-disable-next-line @next/next/no-img-element -- private, authenticated image route
                        ? <img src={`/api/profile/avatar/${user.id}?v=${user.avatarUpdatedAt?.getTime() ?? 0}`} alt="" aria-hidden="true" width={30} height={30} className="avatar" style={{ objectFit: "cover", padding: 0 }} />
                        : <span className="avatar" aria-hidden="true">{initials(user.name)}</span>}
                      <span><span className="cell-primary">{user.name}{user.id === me.id ? <span className="muted" style={{ fontWeight: 400 }}> (you)</span> : null}</span><span className="sub">{user.username ? `@${user.username}` : "No username"}</span></span>
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: ".8125rem" }}>{user.userId ?? "—"}</td>
                  <td>{user.email || "—"}</td>
                  <td>{user.location || "—"}</td>
                  <td><StatusBadge value={user.role} dot={false}>{user.role === "ADMIN" ? "Admin" : "User"}</StatusBadge></td>
                  <td><StatusBadge value={user.enabled ? "Enabled" : "Disabled"} /></td>
                  <td><UserRowActions id={user.id} name={user.name} email={user.email} location={user.location} enabled={user.enabled} isSelf={user.id === me.id} hasAuth={!!user.authUserId} /></td>
                </tr>
              ))}
              {users.length === 0 && <EmptyRow colSpan={7} title="No application users found" description="Use Add user to create the first account." />}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
