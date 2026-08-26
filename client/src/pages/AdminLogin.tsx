/**
 * Quiet Authority admin demo login: a focused, credential-gated prototype entry separate from applicant authentication.
 */
import { AlignmentMark } from "@/components/foundation/navigation";
import { FoundationButton, FoundationInput } from "@/components/foundation/ui";
import { isAdminAuthenticated, signInAdmin } from "@/lib/adminSession";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (isAdminAuthenticated()) setLocation("/admin"); }, [setLocation]);
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (signInAdmin(email, password)) setLocation("/admin"); else setError("The email address or password is incorrect."); };
  return <main className="flex min-h-screen items-center justify-center bg-portal-surface p-5 sm:p-8"><section className="w-full max-w-[450px] rounded-xl border border-border bg-white p-7 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-8"><div className="flex items-center gap-2.5 text-primary"><AlignmentMark /><span className="text-[15px] font-semibold tracking-[-0.02em]">Recruitment Portal</span></div><p className="mt-7 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Administration</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary">Admin sign in</h1><p className="mt-3 text-[15px] leading-7 text-muted-foreground">Sign in to manage recruitment roles, assessments and applications.</p><form className="mt-8 space-y-5" onSubmit={submit} noValidate><label className="block space-y-1.5"><span className="text-sm font-medium text-foreground">Email address</span><FoundationInput onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="admin@example.com" type="email" value={email} /></label><label className="block space-y-1.5"><span className="text-sm font-medium text-foreground">Password</span><div className="relative"><FoundationInput className="pr-11" onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="Enter your password" type={showPassword ? "text" : "password"} value={password} /><button aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-portal-surface hover:text-primary" onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>{error ? <p className="text-[13px] text-status-error-strong" role="alert">{error}</p> : null}<FoundationButton className="mt-2 w-full" size="lg" type="submit">Sign in</FoundationButton></form></section></main>;
}
