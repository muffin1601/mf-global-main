"use client";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "./actions";
export function LoginForm(){const [state,action,pending]=useActionState(loginAction,{});return <form action={action} className="form-grid" style={{marginTop:24}}><div className="field"><label htmlFor="identifier">Username or work email</label><input id="identifier" name="identifier" autoComplete="username" required maxLength={254}/></div><div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256}/></div>{state.error&&<p className="error" role="alert">{state.error}</p>}<button className="button" disabled={pending}>{pending?"Signing in…":"Sign in"}</button><Link href="/crm/forgot-password" style={{fontSize:14,color:"var(--brand)",textAlign:"center"}}>Forgot password?</Link></form>}
