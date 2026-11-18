/**
 * Only same-site, path-only redirect targets are allowed. A prefix check such as
 * `startsWith("/") && !startsWith("//")` is NOT enough: `/\evil.com` and
 * `/<TAB>/evil.com` are normalised by URL parsers into off-site URLs.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  let decoded = next;
  try { decoded = decodeURIComponent(next); } catch { return fallback; }
  for (const candidate of [next, decoded]) {
    if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
    if (/[\\\u0000-\u001f\u007f]/.test(candidate)) return fallback; // backslash, tab, CR/LF, control chars
  }
  try {
    const base = "http://internal.invalid";
    const url = new URL(next, base);
    if (url.origin !== base || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export const RECOVERY_COOKIE = "pw_recovery";
