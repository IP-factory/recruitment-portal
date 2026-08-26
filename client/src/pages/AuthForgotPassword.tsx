/**
 * Quiet Authority password-reset route: visual-only recovery screen with client-side email validation and no reset delivery.
 */
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailField } from "@/components/auth/AuthFields";
import { FoundationButton } from "@/components/foundation/ui";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

export default function AuthForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [completed, setCompleted] = useState(false);
  const error = useMemo(() => !email || !validEmail(email) ? "Enter a valid email address." : "", [email]);
  const formValid = !error;
  const showNotice = () => { setCompleted(true); toast.success("Password reset functionality will be connected in the next implementation stage."); };

  return (
    <AuthLayout>
      <section aria-labelledby="reset-password-title">
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-primary" id="reset-password-title">Reset your password</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">Enter the email address linked to your applicant account.</p>
        <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); if (formValid) showNotice(); }} noValidate>
          <EmailField error={touched ? error : undefined} onBlur={() => setTouched(true)} onChange={setEmail} value={email} />
          <FoundationButton className="w-full" disabled={!formValid} size="lg" type="submit">Send reset link</FoundationButton>
        </form>
        {completed ? <div className="alert-success mt-5 flex gap-2.5 rounded-lg border px-4 py-3 text-sm" role="status"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />Password reset functionality will be connected in the next implementation stage.</div> : null}
        <p className="mt-6 text-center text-sm"><button className="font-medium text-portal-blue hover:text-primary hover:underline" onClick={() => setLocation("/auth/sign-in")} type="button">Back to sign in</button></p>
      </section>
    </AuthLayout>
  );
}
