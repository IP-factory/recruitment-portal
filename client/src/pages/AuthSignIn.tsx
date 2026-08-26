/**
 * Quiet Authority sign-in route: visual-only applicant access screen with local validation and no session creation.
 */
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailField, PasswordField } from "@/components/auth/AuthFields";
import { FoundationButton } from "@/components/foundation/ui";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

export default function AuthSignIn() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const errors = useMemo(() => ({ email: !email || !validEmail(email) ? "Enter a valid email address." : "", password: !password ? "Enter your password." : "" }), [email, password]);
  const formValid = !errors.email && !errors.password;
  const markTouched = (name: string) => setTouched((current) => ({ ...current, [name]: true }));
  const showNotice = () => { setCompleted(true); toast.success("Sign-in functionality will be connected in the next implementation stage."); };

  return (
    <AuthLayout>
      <section aria-labelledby="sign-in-title">
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-primary" id="sign-in-title">Welcome back</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">Sign in to continue your application.</p>
        <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); if (formValid) showNotice(); }} noValidate>
          <EmailField error={touched.email ? errors.email : undefined} onBlur={() => markTouched("email")} onChange={setEmail} value={email} />
          <div><PasswordField error={touched.password ? errors.password : undefined} label="Password" onBlur={() => markTouched("password")} onChange={setPassword} placeholder="Enter your password" value={password} /><button className="mt-2 block w-full text-right text-[13px] font-medium text-portal-blue hover:text-primary hover:underline" onClick={() => setLocation("/auth/forgot-password")} type="button">Forgot password?</button></div>
          <FoundationButton className="w-full" disabled={!formValid} size="lg" type="submit">Sign in</FoundationButton>
        </form>
        {completed ? <div className="alert-success mt-5 flex gap-2.5 rounded-lg border px-4 py-3 text-sm" role="status"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />Sign-in functionality will be connected in the next implementation stage.</div> : null}
        <p className="mt-6 text-center text-sm text-muted-foreground">New applicant? <button className="font-medium text-portal-blue hover:text-primary hover:underline" onClick={() => setLocation("/auth/create-account")} type="button">Create an account</button></p>
      </section>
    </AuthLayout>
  );
}
