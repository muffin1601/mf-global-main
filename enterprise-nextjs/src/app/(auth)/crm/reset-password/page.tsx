import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE } from "@/lib/security/redirect";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/crm/login?error=recovery_expired");
  // A valid session alone is not enough: the user must have arrived through an emailed recovery link.
  if (!(await cookies()).get(RECOVERY_COOKIE)) redirect("/crm/forgot-password");
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <Link className="brand" href="/"><span className="brand-mark">MF</span><span>MF Global Services</span></Link>
        <h1 style={{ fontSize: "2rem", marginTop: "2rem" }}>Choose a new password</h1>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
