/**
 * Quiet Authority auth fields: existing input language with clear, local password visibility and validation feedback.
 */
import { FoundationInput } from "@/components/foundation/ui";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function EmailField({ value, onChange, onBlur, error }: { value: string; onChange: (value: string) => void; onBlur: () => void; error?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-foreground">Email address</span>
      <FoundationInput aria-invalid={Boolean(error)} error={Boolean(error)} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} placeholder="you@example.com" type="email" value={value} />
      {error ? <span className="block text-[13px] text-status-error-strong">{error}</span> : null}
    </label>
  );
}

export function PasswordField({ label, placeholder, value, onChange, onBlur, helper, error }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; onBlur: () => void; helper?: string; error?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <FoundationInput aria-invalid={Boolean(error)} className="pr-11" error={Boolean(error)} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={showPassword ? "text" : "password"} value={value} />
        <button aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-portal-surface hover:text-primary" onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
      </div>
      {error ? <span className="block text-[13px] text-status-error-strong">{error}</span> : helper ? <span className="block text-[13px] text-muted-foreground">{helper}</span> : null}
    </div>
  );
}
