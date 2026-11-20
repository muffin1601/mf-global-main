"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ChevronRight, FileText, LogOut, Menu, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Plus, Search, Sun, Upload, UserPlus, X, Package,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { initialsOf } from "@/components/ui/user-avatar";
import { CommandPalette } from "./command-palette";
import { activeHref, crumbsFor, navFor, type NavItem } from "./nav-config";
import { applyTheme, readTheme, setSidebarCollapsed, type ThemePreference } from "./theme";

export type ShellUser = { name: string; email: string | null; role: "ADMIN" | "USER"; userId: string | null };

const initials = initialsOf;

/* Theme preference as an external store so every toggle stays in sync without effects. */
const themeListeners = new Set<() => void>();
const subscribeTheme = (cb: () => void) => { themeListeners.add(cb); return () => themeListeners.delete(cb); };
const setTheme = (t: ThemePreference) => { applyTheme(t); themeListeners.forEach((l) => l()); };
const useTheme = () => useSyncExternalStore(subscribeTheme, readTheme, () => "light" as ThemePreference);

/** Closes a popover on outside click / Escape and returns focus to its trigger. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); ref.current?.querySelector<HTMLElement>("button")?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

function NavLink({ item, current, onNavigate }: { item: NavItem; current: string | null; onNavigate: () => void }) {
  const Icon = item.icon;
  const active = current === item.href;
  return (
    <Link href={item.href as Route} className="side-link" aria-current={active ? "page" : undefined} data-tip={item.label} onClick={onNavigate}>
      <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
      <span className="label">{item.label}</span>
    </Link>
  );
}

function NavSection({ item, current, onNavigate }: { item: NavItem; current: string | null; onNavigate: () => void }) {
  const children = item.children ?? [];
  const within = children.some((c) => c.href === current);
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? within;
  const Icon = item.icon;
  const id = `nav-sub-${item.href.replace(/\W+/g, "-")}`;
  return (
    <>
      <button
        type="button" className="side-link" aria-expanded={open} aria-controls={id} data-tip={item.label}
        onClick={() => setManual(!open)} style={within && !open ? { color: "var(--primary-soft-text)" } : undefined}
      >
        <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
        <span className="label">{item.label}</span>
        <ChevronRight className="chev" size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="side-sub" id={id}>
          {children.map((c) => (
            <Link key={c.href} href={c.href as Route} className="side-link" aria-current={current === c.href ? "page" : undefined} onClick={onNavigate}>
              <span className="label">{c.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}

function ThemeMenuItems() {
  const theme = useTheme();
  const opts: [ThemePreference, string, typeof Sun][] = [["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]];
  return (
    <div role="group" aria-label="Theme">
      <div className="menu-label">Theme</div>
      {opts.map(([value, label, Icon]) => (
        <button key={value} type="button" role="menuitemradio" aria-checked={theme === value} className="menu-item" onClick={() => setTheme(value)}>
          <Icon size={15} aria-hidden="true" />{label}
          {theme === value ? <span style={{ marginLeft: "auto", color: "var(--primary)" }} aria-hidden="true">●</span> : null}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const isAdmin = user.role === "ADMIN";
  const pathname = usePathname();
  const groups = navFor(isAdmin);
  const current = activeHref(groups, pathname);
  const crumbs = crumbsFor(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menu, setMenu] = useState<null | "create" | "user">(null);
  const closeMenu = () => setMenu(null);
  const createRef = useDismiss(menu === "create", closeMenu);
  const userRef = useDismiss(menu === "user", closeMenu);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const closePalette = () => setPaletteOpen(false);
  const theme = useTheme();
  const leadsHref = isAdmin ? "/crm/lead-management" : "/crm/my-leads";

  // Ctrl/Cmd+K (anywhere) or "/" (outside form fields) opens global search; Ctrl/Cmd+K again closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.key) return;
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setPaletteOpen((o) => !o); }
      else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setPaletteOpen(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const nav = () => setMobileOpen(false);
  const quick: { label: string; href: string; icon: typeof Plus }[] = [
    { label: "New lead", href: `${leadsHref}?create=lead`, icon: UserPlus },
    { label: "New quotation", href: "/crm/quotations/create", icon: FileText },
    { label: "Import leads", href: "/crm/import-leads", icon: Upload },
    ...(isAdmin ? [{ label: "New product", href: "/crm/product-management?create=product", icon: Package }] : []),
  ];

  return (
    <div className="app-shell" data-mobile-open={mobileOpen}>
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar-top">
          <Link className="brand" href="/crm/entrydashboard" onClick={nav} aria-label="MF Global CRM home">
            <BrandLogo />
            <span className="brand-text"><strong>MF Global Services</strong><span>Enterprise CRM</span></span>
          </Link>
          <button type="button" className="icon-btn collapse-btn" onClick={() => setSidebarCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar">
            <PanelLeftClose size={16} />
          </button>
          <button type="button" className="icon-btn mobile-only" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={16} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="CRM navigation">
          <button type="button" className="side-link expand-btn" onClick={() => setSidebarCollapsed(false)} aria-label="Expand sidebar" data-tip="Expand sidebar">
            <PanelLeftOpen size={16} aria-hidden="true" />
          </button>
          {groups.map((g) => (
            <div className="nav-group" key={g.title}>
              <div className="nav-group-title">{g.title}</div>
              {g.items.map((item) => item.children?.length
                ? <NavSection key={item.href} item={item} current={current} onNavigate={nav} />
                : <NavLink key={item.href} item={item} current={current} onNavigate={nav} />)}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip" data-tip={`${user.name} · ${isAdmin ? "Administrator" : "User"}`} style={{ position: "relative" }}>
            <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
            <span className="who"><strong>{user.name}</strong><span>{isAdmin ? "Administrator" : "Sales user"}{user.userId ? ` · ${user.userId}` : ""}</span></span>
          </div>
        </div>
      </aside>
      <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />

      <div className="app-main">
        <header className="topbar">
          <button type="button" className="icon-btn mobile-only" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}>
            <Menu size={18} />
          </button>
          <nav className="crumbs" aria-label="Breadcrumb">
            <ol>
              {crumbs.map((c, i) => (
                <li key={`${c.label}-${i}`} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                  {i > 0 ? <ChevronRight size={13} aria-hidden="true" /> : null}
                  {c.href && i < crumbs.length - 1 ? <Link href={c.href as Route}>{c.label}</Link> : <span>{c.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
          <button type="button" className="global-search" onClick={() => setPaletteOpen(true)} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K /">
            <Search size={15} aria-hidden="true" />
            <span className="global-search-text">Search records or jump to…</span>
            <kbd aria-hidden="true">Ctrl K</kbd>
          </button>
          <button type="button" className="icon-btn mobile-search" onClick={() => setPaletteOpen(true)} aria-label="Search">
            <Search size={17} />
          </button>
          <div className="topbar-actions">
            <div className="menu-wrap" ref={createRef}>
              <button type="button" className="button small" aria-haspopup="menu" aria-expanded={menu === "create"} onClick={() => setMenu(menu === "create" ? null : "create")}>
                <Plus size={15} aria-hidden="true" /><span className="create-label">Create</span>
              </button>
              {menu === "create" ? (
                <div className="menu" role="menu" aria-label="Create">
                  {quick.map(({ label, href, icon: Icon }) => (
                    <Link key={href} role="menuitem" className="menu-item" href={href as Route} onClick={closeMenu}><Icon size={15} aria-hidden="true" />{label}</Link>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button" className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="menu-wrap" ref={userRef}>
              <button type="button" className="icon-btn" style={{ width: 36 }} aria-haspopup="menu" aria-expanded={menu === "user"} aria-label="Account menu" onClick={() => setMenu(menu === "user" ? null : "user")}>
                <span className="avatar sm" aria-hidden="true">{initials(user.name)}</span>
              </button>
              {menu === "user" ? (
                <div className="menu" role="menu" aria-label="Account" style={{ minWidth: 248 }}>
                  <div className="menu-head">
                    <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
                    <span className="who"><strong>{user.name}</strong><span>{user.email ?? (isAdmin ? "Administrator" : "Sales user")}</span></span>
                  </div>
                  <div className="menu-sep" />
                  <ThemeMenuItems />
                  <div className="menu-sep" />
                  <form action="/auth/signout" method="post">
                    <button type="submit" role="menuitem" className="menu-item danger"><LogOut size={15} aria-hidden="true" />Sign out</button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div id="main" tabIndex={-1} style={{ outline: "none" }}>{children}</div>
      </div>
      <CommandPalette open={paletteOpen} onClose={closePalette} isAdmin={isAdmin} userKey={user.userId ?? user.name} quickActions={quick} />
    </div>
  );
}
