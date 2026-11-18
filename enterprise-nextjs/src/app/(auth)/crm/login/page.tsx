import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
export const metadata:Metadata={title:"CRM sign in",robots:{index:false,follow:false}};
export default function LoginPage(){return <main className="auth-wrap"><section className="auth-card"><Link className="brand" href="/"><span className="brand-mark">MF</span><span>MF Global Services</span></Link><h1 style={{fontSize:"2rem",marginTop:"2rem"}}>Welcome back</h1><p className="lead" style={{fontSize:"1rem"}}>Sign in to your secure CRM workspace.</p><LoginForm/></section></main>}
