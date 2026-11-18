/** Client-side helper (replaces MERN utils/logActivity.jsx). Never throws: logging must not break the UI. */
export async function logActivity(action: string, details: Record<string, unknown> = {}): Promise<void> {
  try {
    await fetch("/api/activity/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, details }),
      keepalive: true,
    });
  } catch {
    // best-effort
  }
}
