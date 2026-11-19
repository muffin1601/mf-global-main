import type { LucideIcon } from "lucide-react";
import {
  BarChart3, BriefcaseBusiness, CalendarClock, Clock, FileText, Flame, History, Inbox, LayoutDashboard, LineChart,
  ListChecks, Package, PackageSearch, Settings, Sparkles, Tags, Trophy, TrendingUp, Truck, Upload, UserCheck, Users,
} from "lucide-react";

export type NavLeaf = { label: string; href: string; icon: LucideIcon };
export type NavItem = NavLeaf & { children?: readonly NavLeaf[] };
export type NavGroup = { title: string; adminOnly?: boolean; items: readonly (NavItem & { adminOnly?: boolean })[] };

/**
 * The CRM route map. Visibility mirrors the pre-redesign navigation exactly (`adminOnly` groups/items);
 * every page still enforces its own access check on the server — hiding a link is never the control.
 */
export const NAV: readonly NavGroup[] = [
  { title: "Overview", items: [{ label: "Dashboard", href: "/crm/entrydashboard", icon: LayoutDashboard }] },
  {
    title: "My work",
    items: [
      { label: "My leads", href: "/crm/my-leads", icon: BriefcaseBusiness },
      { label: "My trending leads", href: "/crm/my-trending-leads", icon: Flame },
      { label: "My conversions", href: "/crm/conversions", icon: Trophy },
      { label: "Today's follow-ups", href: "/crm/today-followups", icon: Clock },
      { label: "Upcoming follow-ups", href: "/crm/upcoming-followups", icon: CalendarClock },
    ],
  },
  {
    title: "Leads",
    adminOnly: true,
    items: [
      { label: "All leads", href: "/crm/lead-management", icon: ListChecks },
      { label: "New leads", href: "/crm/new-leads", icon: Sparkles },
      { label: "Assigned leads", href: "/crm/assigned-leads", icon: UserCheck },
      { label: "Unassigned leads", href: "/crm/unassigned-leads", icon: Inbox },
      { label: "Trending leads", href: "/crm/trending-leads", icon: TrendingUp },
      { label: "Won leads", href: "/crm/won-leads", icon: Trophy },
    ],
  },
  {
    title: "Sales operations",
    items: [
      { label: "Quotations", href: "/crm/quotations", icon: FileText },
      { label: "Products", href: "/crm/product-management", icon: Package, adminOnly: true },
      { label: "Product dashboard", href: "/crm/product-dashboard", icon: PackageSearch, adminOnly: true },
      {
        label: "Vendors", href: "/crm/vendors", icon: Truck,
        children: [
          { label: "All vendors", href: "/crm/vendors", icon: Truck },
          { label: "Active", href: "/crm/vendors/active", icon: Truck },
          { label: "Pending", href: "/crm/vendors/pending", icon: Truck },
          { label: "Inactive", href: "/crm/vendors/inactive", icon: Truck },
          { label: "Categories", href: "/crm/vendors/categories", icon: Tags },
          { label: "Vendor settings", href: "/crm/vendors/settings", icon: Settings },
        ],
      },
    ],
  },
  {
    title: "Data & analytics",
    items: [
      { label: "Import leads", href: "/crm/import-leads", icon: Upload },
      { label: "Lead insertion report", href: "/crm/reports/lead-insertion", icon: LineChart, adminOnly: true },
      { label: "Vendor performance", href: "/crm/vendors/performance", icon: BarChart3, adminOnly: true },
    ],
  },
  {
    title: "Administration",
    adminOnly: true,
    items: [
      { label: "User management", href: "/crm/user-management", icon: Users },
      { label: "Activity log", href: "/crm/activity-log", icon: History },
    ],
  },
];

export function navFor(isAdmin: boolean): NavGroup[] {
  return NAV.filter((g) => isAdmin || !g.adminOnly)
    .map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) }))
    .filter((g) => g.items.length > 0);
}

/** Longest nav href that prefixes the path — that item is "current". */
export function activeHref(groups: readonly NavGroup[], pathname: string): string | null {
  let best: string | null = null;
  for (const g of groups) for (const i of g.items) for (const leaf of [i, ...(i.children ?? [])]) {
    const h = leaf.href;
    if ((pathname === h || pathname.startsWith(`${h}/`)) && (!best || h.length > best.length)) best = h;
  }
  return best;
}

const EXTRA_CRUMBS: [RegExp, string][] = [
  [/^\/crm\/quotations\/create$/, "New quotation"],
  [/^\/crm\/quotations\/[^/]+\/edit$/, "Edit quotation"],
  [/^\/crm\/lead-management\/[^/]+$/, "Lead details"],
  [/^\/crm\/vendors\/import$/, "Import vendors"],
  [/^\/crm\/vendors\/(?!active$|pending$|inactive$|categories$|settings$|performance$|import$)[^/]+$/, "Vendor profile"],
];

/** Breadcrumb trail: group › page › (detail). Uses ALL nav (not role-filtered) so labels never go blank. */
export function crumbsFor(pathname: string): { label: string; href?: string }[] {
  let found: { group: string; parent?: NavLeaf; leaf: NavLeaf } | null = null;
  for (const g of NAV) for (const i of g.items) for (const leaf of [i, ...(i.children ?? [])]) {
    if ((pathname === leaf.href || pathname.startsWith(`${leaf.href}/`)) && (!found || leaf.href.length > found.leaf.href.length)) {
      found = { group: g.title, parent: leaf === i ? undefined : i, leaf };
    }
  }
  if (!found) return [{ label: "CRM" }];
  const trail: { label: string; href?: string }[] = [{ label: found.group }];
  if (found.parent && found.parent.href !== found.leaf.href) trail.push({ label: found.parent.label, href: found.parent.href });
  trail.push({ label: found.leaf.label, href: found.leaf.href });
  const extra = EXTRA_CRUMBS.find(([re]) => re.test(pathname));
  if (extra && pathname !== found.leaf.href) trail.push({ label: extra[1] });
  else trail[trail.length - 1] = { label: found.leaf.label };
  return trail;
}
