/**
 * Quiet Authority create-account route: visual-only applicant account setup with local validation and no authentication provider.
 */
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailField, PasswordField } from "@/components/auth/AuthFields";
import { FoundationButton } from "@/components/foundation/ui";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

export default function AuthCreateAccount() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);

  const errors = useMemo(() => ({
    email: !email ? "Enter a valid email address." : !validEmail(email) ? "Enter a valid email address." : "",
    password: !password ? "Enter your password." : password.length < 8 ? "Password must be at least 8 characters." : "",
    confirmPassword: !confirmPassword ? "" : password !== confirmPassword ? "Passwords do not match." : "",
    terms: !acceptedTerms ? "You must accept the Privacy Notice and Terms of Use to continue." : "",
  }), [email, password, confirmPassword, acceptedTerms]);
  const formValid = !errors.email && !errors.password && !errors.confirmPassword && !errors.terms && Boolean(confirmPassword);
  const markTouched = (name: string) => setTouched((current) => ({ ...current, [name]: true }));
  const showNotice = () => { setCompleted(true); toast.success("Account creation will be connected in the next implementation stage."); };

  return (
    <AuthLayout>
      <section aria-labelledby="create-account-title">
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-primary" id="create-account-title">Create your applicant account</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">Create an account to begin and save your application for the Business Development Manager role.</p>
        <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); if (formValid) showNotice(); }} noValidate>
          <div><EmailField error={touched.email ? errors.email : undefined} onBlur={() => markTouched("email")} onChange={setEmail} value={email} /><p className="mt-1.5 text-[13px] text-muted-foreground">Use an email address you can access throughout the recruitment process.</p></div>
          <PasswordField error={touched.password ? errors.password : undefined} helper="Use at least 8 characters." label="Create password" onBlur={() => markTouched("password")} onChange={setPassword} placeholder="Enter a password" value={password} />
          <PasswordField error={touched.confirmPassword ? errors.confirmPassword : undefined} label="Confirm password" onBlur={() => markTouched("confirmPassword")} onChange={setConfirmPassword} placeholder="Re-enter your password" value={confirmPassword} />
          <div className="space-y-1.5"><label className="flex items-start gap-2.5 text-sm leading-5 text-foreground"><input aria-invalid={touched.terms && Boolean(errors.terms)} checked={acceptedTerms} className="mt-0.5 size-4 rounded border-input accent-primary" onBlur={() => markTouched("terms")} onChange={(event) => setAcceptedTerms(event.target.checked)} type="checkbox" /><span>I agree to the <button className="font-medium text-portal-blue hover:text-primary hover:underline" onClick={() => toast.info("Privacy Notice will be available in a future stage.")} type="button">Privacy Notice</button> and <button className="font-medium text-portal-blue hover:text-primary hover:underline" onClick={() => toast.info("Terms of Use will be available in a future stage.")} type="button">Terms of Use</button>.</span></label>{touched.terms && errors.terms ? <span className="block text-[13px] text-status-error-strong">{errors.terms}</span> : null}</div>
          <FoundationButton className="w-full" disabled={!formValid} size="lg" type="submit">Create account</FoundationButton>
        </form>
        {completed ? <div className="alert-success mt-5 flex gap-2.5 rounded-lg border px-4 py-3 text-sm" role="status"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />Account creation will be connected in the next implementation stage.</div> : null}
        <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <button className="font-medium text-portal-blue hover:text-primary hover:underline" onClick={() => setLocation("/auth/sign-in")} type="button">Sign in</button></p>
      </section>
    </AuthLayout>
  );
}
