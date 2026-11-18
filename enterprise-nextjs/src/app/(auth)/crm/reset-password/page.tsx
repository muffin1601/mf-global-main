import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";
export default async function ResetPasswordPage(){const supabase=await createSupabaseServerClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect("/crm/login?error=recovery_expired");return <main className="auth-wrap"><section className="auth-card"><Link className="brand" href="/"><span className="brand-mark">MF</span><span>MF Global Services</span></Link><h1 style={{fontSize:"2rem",marginTop:"2rem"}}>Choose a new password</h1><ResetPasswordForm/></section></main>}
