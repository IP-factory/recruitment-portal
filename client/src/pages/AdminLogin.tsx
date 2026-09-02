/**
 * Quiet Authority admin sign in (Task 24B): the approved focused login design,
 * now backed by real server authentication. Credentials are verified only by
 * the server session endpoint; the frontend never compares credentials and no
 * demo grant exists. Already-authorized Admins are redirected away.
 */
import { AlignmentMark, BrandLogo } from "@/components/foundation/navigation";
import { FoundationButton, FoundationInput } from "@/components/foundation/ui";
import { resolveAdminLoginRedirect, useAdminReturnPath, useAdminSession } from "@/contexts/AdminAuthContext";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";

const SIGN_IN_ERROR = "Unable to sign in with those details.";

export default function AdminLogin() {
  const { state, signIn } = useAdminSession();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const returnPath = useAdminReturnPath();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(() => (new URLSearchParams(search).has("authError") ? SIGN_IN_ERROR : ""));
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const loginRedirect = resolveAdminLoginRedirect(state, returnPath);
  useEffect(() => { if (loginRedirect) setLocation(loginRedirect); }, [loginRedirect, setLocation]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFieldErrors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) nextFieldErrors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) nextFieldErrors.email = "Enter a valid email address.";
    if (!password) nextFieldErrors.password = "Enter your password.";
    setFieldErrors(nextFieldErrors);
    if (nextFieldErrors.email || nextFieldErrors.password) return;
    setSubmitting(true);
    setError("");
    const accepted = await signIn(trimmedEmail, password);
    if (accepted) {
      const target = returnPath ?? "/admin";
      setLocation(target);
      return;
    }
    setSubmitting(false);
    setError(SIGN_IN_ERROR);
  };

  return <main className="flex min-h-screen items-center justify-center bg-portal-surface p-5 sm:p-8"><section className="w-full max-w-[450px] rounded-xl border border-border bg-white p-7 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-8"><div className="flex items-center gap-2.5"><BrandLogo className="max-h-8" /></div><p className="mt-7 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Administration</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary">Admin sign in</h1><p className="mt-3 text-[15px] leading-7 text-muted-foreground">Sign in to manage recruitment roles, assessments and applications.</p><form className="mt-8 space-y-5" noValidate onSubmit={(event) => { void submit(event); }}><label className="block space-y-1.5"><span className="text-sm font-medium text-foreground">Email address</span><FoundationInput aria-invalid={fieldErrors.email ? true : undefined} onChange={(event) => { setEmail(event.target.value); setError(""); setFieldErrors((current) => ({ ...current, email: undefined })); }} placeholder="admin@example.com" type="email" value={email} />{fieldErrors.email ? <span className="text-[13px] text-status-error-strong" role="alert">{fieldErrors.email}</span> : null}</label><label className="block space-y-1.5"><span className="text-sm font-medium text-foreground">Password</span><div className="relative"><FoundationInput aria-invalid={fieldErrors.password ? true : undefined} className="pr-11" onChange={(event) => { setPassword(event.target.value); setError(""); setFieldErrors((current) => ({ ...current, password: undefined })); }} placeholder="Enter your password" type={showPassword ? "text" : "password"} value={password} /><button aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-portal-surface hover:text-primary" onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{fieldErrors.password ? <span className="text-[13px] text-status-error-strong" role="alert">{fieldErrors.password}</span> : null}</label>{error ? <p className="text-[13px] text-status-error-strong" role="alert">{error}</p> : null}<FoundationButton className="mt-2 w-full" disabled={submitting} loading={submitting} size="lg" type="submit">{submitting ? "Signing in…" : "Sign in"}</FoundationButton></form></section></main>;
}
