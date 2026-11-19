import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE } from "@/lib/security/redirect";
import { ResetPasswordForm } from "./reset-password-form";
import { BrandLogo } from "@/components/ui/brand-logo";

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/crm/login?error=recovery_expired");
  // A valid session alone is not enough: the user must have arrived through an emailed recovery link.
  if (!(await cookies()).get(RECOVERY_COOKIE)) redirect("/crm/forgot-password");
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <Link className="brand" href="/"><BrandLogo size={36} /><span className="brand-text"><strong>MF Global Services</strong><span>Enterprise CRM</span></span></Link>
        <h1>Choose a new password</h1>
        <p className="lead">Use at least 12 characters.</p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
