/**
 * Auth form field components: email and password inputs wired to the foundation
 * FieldFrame + FoundationInput primitives.
 *
 * These are intentionally minimal — they exist to satisfy the auth page imports
 * that were present before this file was created. Extend as needed when the
 * authentication feature is fully implemented.
 */
import { FieldFrame, FoundationInput } from "@/components/foundation/ui";

interface EmailFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
}

export function EmailField({ value, onChange, onBlur, error }: EmailFieldProps) {
  return (
    <FieldFrame error={error} label="Email address" required>
      <FoundationInput
        aria-describedby={error ? "email-error" : undefined}
        autoComplete="email"
        error={!!error}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        placeholder="you@example.com"
        type="email"
        value={value}
      />
    </FieldFrame>
  );
}

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  label?: string;
  placeholder?: string;
  helper?: string;
}

export function PasswordField({
  value,
  onChange,
  onBlur,
  error,
  label = "Password",
  placeholder = "Enter your password",
  helper,
}: PasswordFieldProps) {
  return (
    <FieldFrame error={error} helper={helper} label={label} required>
      <FoundationInput
        aria-describedby={error ? "password-error" : undefined}
        autoComplete="current-password"
        error={!!error}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type="password"
        value={value}
      />
    </FieldFrame>
  );
}
