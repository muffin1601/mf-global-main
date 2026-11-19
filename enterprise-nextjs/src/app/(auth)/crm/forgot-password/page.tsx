import Link from "next/link";
import { ForgotPasswordForm } from "./reset-request-form";
import { BrandLogo } from "@/components/ui/brand-logo";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <Link className="brand" href="/"><BrandLogo size={36} /><span className="brand-text"><strong>MF Global Services</strong><span>Enterprise CRM</span></span></Link>
        <h1>Reset your password</h1>
        <p className="lead">We will email a secure recovery link to your work address.</p>
        <ForgotPasswordForm />
        <p className="auth-foot"><Link href="/crm/login">Return to sign in</Link></p>
      </section>
    </main>
  );
}
