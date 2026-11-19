import type { UserRole } from "@/generated/prisma/enums";
import { AppShell } from "./app-shell";

// Server wrapper: passes only the display fields the shell needs (never ids used for authorization).
// Navigation and its role filtering live in ./nav-config.ts.
export function CrmShell({ children, user }: {
  children: React.ReactNode;
  user: { name: string; role: UserRole; email?: string | null; userId?: string | null };
}) {
  return (
    <AppShell user={{ name: user.name, role: user.role, email: user.email ?? null, userId: user.userId ?? null }}>
      {children}
    </AppShell>
  );
}
