import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { BrandLogo } from "@/components/ui/brand-logo";

export const metadata: Metadata = { title: "CRM sign in", robots: { index: false, follow: false } };

// Reasons the app redirects here with (session.ts, reset-password, auth/callback).
const NOTICES: Record<string, string> = {
  disabled: "Your account has been disabled. Contact an administrator to restore access.",
  recovery_expired: "That recovery link has expired. Request a new one from Forgot password.",
  auth_callback: "We could not complete sign-in from that link. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const raw = (await searchParams).error;
  const notice = NOTICES[Array.isArray(raw) ? raw[0] ?? "" : raw ?? ""];
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <Link className="brand" href="/"><BrandLogo size={36} /><span className="brand-text"><strong>MF Global Services</strong><span>Enterprise CRM</span></span></Link>
        <h1>Welcome back</h1>
        <p className="lead">Sign in to your CRM workspace.</p>
        {notice ? <div className="callout tone-warning" role="alert" style={{ marginTop: 16 }}>{notice}</div> : null}
        <LoginForm />
      </section>
    </main>
  );
}
