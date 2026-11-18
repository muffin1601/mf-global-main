import Link from "next/link";
import type { Route } from "next";
import {
  BarChart3, BriefcaseBusiness, CalendarClock, Clock, FileText, History, Inbox, LayoutDashboard, LineChart,
  Package, Tags, Trophy, TrendingUp, Truck, Upload, UserCheck, Users, ListChecks, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/generated/prisma/enums";

type NavItem = readonly [label: string, href: string, icon: LucideIcon];
type NavGroup = { title: string; adminOnly?: boolean; items: readonly NavItem[] };

// Route map for the whole CRM. Each route is owned by one module (see
// docs/REMEDIATION_CONVENTIONS.md). Links to routes that are not built yet are
// harmless 404s until the module lands.
const groups: readonly NavGroup[] = [
  { title: "Workspace", items: [["Dashboard", "/crm/entrydashboard", LayoutDashboard]] },
  {
    title: "My work",
    items: [
      ["My leads", "/crm/my-leads", BriefcaseBusiness],
      ["My trending leads", "/crm/my-trending-leads", TrendingUp],
      ["My conversions", "/crm/conversions", Trophy],
      ["Today's follow-ups", "/crm/today-followups", Clock],
      ["Upcoming follow-ups", "/crm/upcoming-followups", CalendarClock],
      ["Import leads", "/crm/import-leads", Upload],
    ],
  },
  {
    title: "Lead management",
    adminOnly: true,
    items: [
      ["All leads", "/crm/lead-management", ListChecks],
      ["Unassigned leads", "/crm/unassigned-leads", Inbox],
      ["Assigned leads", "/crm/assigned-leads", UserCheck],
      ["New leads", "/crm/new-leads", Inbox],
      ["Trending leads", "/crm/trending-leads", TrendingUp],
      ["Won leads", "/crm/won-leads", Trophy],
      ["Lead insertion report", "/crm/reports/lead-insertion", LineChart],
    ],
  },
  {
    title: "Sales",
    items: [["Quotations", "/crm/quotations", FileText]],
  },
  {
    title: "Catalogue",
    adminOnly: true,
    items: [
      ["Products", "/crm/product-management", Package],
      ["Product dashboard", "/crm/product-dashboard", BarChart3],
    ],
  },
  {
    title: "Vendors",
    items: [
      ["All vendors", "/crm/vendors", Truck],
      ["Active", "/crm/vendors/active", Truck],
      ["Pending", "/crm/vendors/pending", Truck],
      ["Inactive", "/crm/vendors/inactive", Truck],
      ["Categories", "/crm/vendors/categories", Tags],
      ["Settings", "/crm/vendors/settings", Settings],
    ],
  },
  {
    title: "Administration",
    adminOnly: true,
    items: [
      ["User management", "/crm/user-management", Users],
      ["Vendor performance", "/crm/vendors/performance", BarChart3],
      ["Activity log", "/crm/activity-log", History],
    ],
  },
];

export function CrmShell({ children, user }: { children: React.ReactNode; user: { name: string; role: UserRole } }) {
  const isAdmin = user.role === "ADMIN";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/crm/entrydashboard">
          <span className="brand-mark">MF</span>
          <span>Enterprise CRM</span>
        </Link>
        {groups.filter((group) => isAdmin || !group.adminOnly).map((group) => (
          <div key={group.title}>
            <div className="nav-group">{group.title}</div>
            {group.items.map(([label, href, Icon]) => (
              <Link className="side-link" href={href as Route} key={href}>
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </div>
        ))}
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div><strong>MF Global Services</strong></div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{user.name} · {user.role.toLowerCase()}</span>
            <form action="/auth/signout" method="post"><button className="button secondary" type="submit">Sign out</button></form>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
