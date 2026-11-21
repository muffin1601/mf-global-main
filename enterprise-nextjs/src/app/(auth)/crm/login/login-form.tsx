"use client";
import { PasswordInput } from "@/legacy-marketing/components/PasswordInput";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "./actions";
export function LoginForm(){const [state,action,pending]=useActionState(loginAction,{});return <form action={action} className="form-grid"><div className="field"><label htmlFor="identifier">Username or work email</label><input id="identifier" name="identifier" autoComplete="username" required maxLength={254}/></div><div className="field"><label htmlFor="password">Password</label><PasswordInput fieldLabel="password" id="password" name="password" autoComplete="current-password" required maxLength={256}/></div>{state.error&&<p className="error" role="alert">{state.error}</p>}<button className="button" disabled={pending}>{pending?"Signing in…":"Sign in"}</button><p className="auth-foot" style={{margin:0}}><Link href="/crm/forgot-password">Forgot password?</Link></p></form>}
