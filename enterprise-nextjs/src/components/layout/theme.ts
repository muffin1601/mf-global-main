// Theme + sidebar preferences. Both are per-browser conveniences, so localStorage is the right store;
// every access is guarded because storage can be unavailable (private mode, blocked site data).
export type ThemePreference = "light" | "dark" | "system";
export const THEME_KEY = "mf-crm-theme";
export const SIDEBAR_KEY = "mf-crm-sidebar";

/**
 * Runs before first paint (inlined in <head>) so the page never flashes the wrong theme or sidebar width.
 * Light is the default enterprise theme; "system" follows the OS setting live.
 */
export const PREFERENCE_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,t=localStorage.getItem("${THEME_KEY}");var m=window.matchMedia("(prefers-color-scheme: dark)");var a=function(){var dark=t==="dark"||(t==="system"&&m.matches);if(dark)d.setAttribute("data-theme","dark");else d.removeAttribute("data-theme");};a();if(t==="system"&&m.addEventListener)m.addEventListener("change",a);if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")d.setAttribute("data-sidebar","collapsed");}catch(e){}})();`;

export function readTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(pref: ThemePreference) {
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* preference simply won't persist */ }
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

export function setSidebarCollapsed(collapsed: boolean) {
  try { localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded"); } catch { /* ignore */ }
  if (collapsed) document.documentElement.setAttribute("data-sidebar", "collapsed");
  else document.documentElement.removeAttribute("data-sidebar");
}
