// Password policy shared by the browser checklist and the server (single source of truth). Pure: no server imports.
export const PASSWORD_RULES = [
  { id: "length", label: "At least 12 characters", test: (p: string) => p.length >= 12 && p.length <= 256 },
  { id: "classes", label: "Three of: lowercase, uppercase, number, symbol", test: (p: string) => [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length >= 3 },
] as const;

export function passwordProblems(next: string, ctx: { username?: string | null; email?: string | null; name?: string | null }) {
  const problems: string[] = PASSWORD_RULES.filter((r) => !r.test(next)).map((r) => r.label);
  const lower = next.toLowerCase();
  const personal = [ctx.username, ctx.email?.split("@")[0], ...(ctx.name ?? "").split(/\s+/)].filter((v): v is string => !!v && v.length >= 4);
  if (personal.some((v) => lower.includes(v.toLowerCase()))) problems.push("Must not contain your name, username or email");
  return problems;
}

/** 0-4 strength score for the meter (presentation only; acceptance is decided by passwordProblems). */
export function passwordStrength(p: string): number {
  if (!p) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  return Math.min(4, (p.length >= 12 ? 1 : 0) + (p.length >= 16 ? 1 : 0) + (classes >= 3 ? 1 : 0) + (classes === 4 ? 1 : 0));
}
