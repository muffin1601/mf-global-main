"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Clock, CornerDownLeft, FileText, Loader2, Package, Search, Truck, UserRound } from "lucide-react";
import type { SearchEntity, SearchHit, SearchResult } from "@/server/search/service";
import { navFor } from "./nav-config";

/**
 * Global search + command palette (Ctrl/Cmd+K or "/").
 * - Record search runs on the server (/api/search) with the caller's permissions; nothing is
 *   filtered client-side, and at most a handful of rows per entity reach the browser.
 * - Navigation entries come from the same role-filtered nav as the sidebar.
 * - "Recent" is a per-user, per-browser convenience in localStorage. Opening an item still goes
 *   through the page's own server-side access check.
 * ARIA: combobox input + listbox, active option via aria-activedescendant.
 */

type Item = { key: string; group: string; label: string; sub?: string; href: string; icon: LucideIcon; badge?: string; hit?: SearchHit };

const ENTITY_ICON: Record<SearchEntity, LucideIcon> = { lead: UserRound, quotation: FileText, product: Package, vendor: Truck };
const MAX_RECENT = 6;

const recentKey = (userKey: string) => `mf-crm-recent:${userKey}`;
function readRecent(userKey: string): SearchHit[] {
  try {
    const raw = window.localStorage.getItem(recentKey(userKey));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list.filter((h) => h && typeof h.href === "string" && h.href.startsWith("/crm/")) as SearchHit[]).slice(0, MAX_RECENT) : [];
  } catch { return []; }
}
function pushRecent(userKey: string, hit: SearchHit) {
  try {
    const next = [hit, ...readRecent(userKey).filter((h) => !(h.type === hit.type && h.id === hit.id))].slice(0, MAX_RECENT);
    window.localStorage.setItem(recentKey(userKey), JSON.stringify(next));
  } catch { /* storage unavailable: recents are optional */ }
}

const noopSubscribe = () => () => {};

export function CommandPalette({ open, onClose, isAdmin, userKey, quickActions }: {
  open: boolean; onClose: () => void; isAdmin: boolean; userKey: string;
  quickActions: { label: string; href: string; icon: LucideIcon }[];
}) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted || !open) return null;
  return createPortal(<Palette onClose={onClose} isAdmin={isAdmin} userKey={userKey} quickActions={quickActions} />, document.body);
}

function Palette({ onClose, isAdmin, userKey, quickActions }: {
  onClose: () => void; isAdmin: boolean; userKey: string; quickActions: { label: string; href: string; icon: LucideIcon }[];
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [recent] = useState(() => readRecent(userKey));
  const term = query.trim();
  const searching = term.length >= 2;

  // Focus the input, lock page scroll, restore focus on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; if (previous && document.contains(previous)) previous.focus(); };
  }, []);

  // Debounced, abortable server search.
  useEffect(() => {
    if (!searching) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setFailed(false);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        setResult((await res.json()) as SearchResult);
      } catch (e) {
        if ((e as Error).name !== "AbortError") { setFailed(true); setResult(null); }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { ctrl.abort(); window.clearTimeout(timer); };
  }, [term, searching]);

  const pages = useMemo(() => navFor(isAdmin).flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? []).filter((c) => c.href !== i.href)]).map((leaf) => ({ group: g.title, leaf }))), [isAdmin]);

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    if (!searching) {
      for (const h of recent) out.push({ key: `r-${h.type}-${h.id}`, group: "Recent", label: h.title, sub: h.subtitle, href: h.href, icon: ENTITY_ICON[h.type] ?? Clock, badge: h.badge, hit: h });
      for (const a of quickActions) out.push({ key: `a-${a.href}`, group: "Quick actions", label: a.label, href: a.href, icon: a.icon });
      for (const { group, leaf } of pages) out.push({ key: `p-${leaf.href}`, group: "Go to", label: leaf.label, sub: group, href: leaf.href, icon: leaf.icon });
      return out;
    }
    const lower = term.toLowerCase();
    for (const g of result?.query.toLowerCase() === lower ? result.groups : []) {
      for (const h of g.hits) out.push({ key: `h-${h.type}-${h.id}`, group: g.label, label: h.title, sub: h.subtitle, href: h.href, icon: ENTITY_ICON[h.type], badge: h.badge, hit: h });
    }
    const leadsHref = isAdmin ? "/crm/lead-management" : "/crm/my-leads";
    out.push({ key: "all-leads", group: "Actions", label: `Search all leads for “${term}”`, href: `${leadsHref}?q=${encodeURIComponent(term)}`, icon: Search });
    for (const { group, leaf } of pages) {
      if (leaf.label.toLowerCase().includes(lower) || group.toLowerCase().includes(lower)) out.push({ key: `p-${leaf.href}`, group: "Go to", label: leaf.label, sub: group, href: leaf.href, icon: leaf.icon });
    }
    return out;
  }, [searching, recent, quickActions, pages, term, result, isAdmin]);

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));
  const optionId = (i: number) => `${listId}-opt-${i}`;

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const choose = useCallback((item: Item | undefined) => {
    if (!item) return;
    if (item.hit) pushRecent(userKey, item.hit);
    onClose();
    router.push(item.href as Route);
  }, [onClose, router, userKey]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((activeIndex + 1) % Math.max(items.length, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((activeIndex - 1 + items.length) % Math.max(items.length, 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(items.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); choose(items[activeIndex]); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    else if (e.key === "Tab") { e.preventDefault(); } // keep focus in the palette
  };

  const pendingSearch = searching && (loading || result?.query.toLowerCase() !== term.toLowerCase()) && !failed;
  const hitCount = items.filter((i) => i.hit).length;

  return (
    <div className="dialog-overlay cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search and commands" onKeyDown={onKeyDown}>
        <div className="cmdk-input">
          {pendingSearch ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
          <input
            ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Search leads, quotations, products, vendors… or jump to a page"
            role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
            aria-activedescendant={items.length ? optionId(activeIndex) : undefined} autoComplete="off" spellCheck={false}
            aria-label="Search records and pages"
          />
          <kbd aria-hidden="true">Esc</kbd>
        </div>
        <div className="cmdk-list" id={listId} role="listbox" ref={listRef} aria-label="Results">
          {items.map((item, i) => {
            const header = i === 0 || items[i - 1]?.group !== item.group ? item.group : null;
            const Icon = item.icon;
            return (
              <div key={item.key} role="presentation">
                {header ? <div className="cmdk-group" role="presentation">{header}</div> : null}
                <div
                  id={optionId(i)} data-index={i} role="option" aria-selected={i === activeIndex} className="cmdk-item"
                  onMouseMove={() => { if (i !== activeIndex) setActive(i); }} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(item)}
                >
                  <span className="cmdk-icon" aria-hidden="true"><Icon size={15} /></span>
                  <span className="cmdk-text"><span className="cmdk-label">{item.label}</span>{item.sub ? <span className="cmdk-sub">{item.sub}</span> : null}</span>
                  {item.badge ? <span className="badge tone-neutral">{item.badge}</span> : null}
                  {i === activeIndex ? <CornerDownLeft size={13} className="cmdk-enter" aria-hidden="true" /> : <ArrowRight size={13} className="cmdk-enter dim" aria-hidden="true" />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="cmdk-foot" aria-live="polite">
          {failed ? <span className="error">Search is unavailable right now. Try again.</span>
            : searching ? (pendingSearch ? <span>Searching…</span> : <span>{hitCount ? `${hitCount} matching record${hitCount === 1 ? "" : "s"}` : "No matching records you can access"}</span>)
            : <span>Type at least 2 characters to search records</span>}
          <span className="cmdk-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>↵</kbd> open</span>
        </div>
      </div>
    </div>
  );
}
