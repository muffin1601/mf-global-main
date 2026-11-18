import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE, safeNextPath } from "@/lib/security/redirect";

const DEFAULT_NEXT = "/crm/entrydashboard";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), DEFAULT_NEXT);
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(next, url.origin));
      // Marks this browser as having just completed an emailed recovery link, so
      // /crm/reset-password cannot be used by an ordinary signed-in session.
      if (next.startsWith("/crm/reset-password")) {
        response.cookies.set(RECOVERY_COOKIE, "1", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/crm", maxAge: 15 * 60 });
      }
      return response;
    }
  }
  return NextResponse.redirect(new URL("/crm/login?error=auth_callback", url.origin));
}
