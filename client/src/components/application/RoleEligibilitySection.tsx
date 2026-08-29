import { FieldFrame, FoundationInput, FoundationSelect } from "@/components/foundation/ui";
import type { ApplicantEligibilityAnswers } from "@/lib/eligibilityData";

type Props = {
  answers: ApplicantEligibilityAnswers;
  touched: Record<string, boolean>;
  onChange: <Key extends keyof ApplicantEligibilityAnswers>(field: Key, value: ApplicantEligibilityAnswers[Key]) => void;
  onBlur: (field: string) => void;
};

function Choice({ checked, children, name, onChange, value }: { checked: boolean; children: React.ReactNode; name: string; onChange: () => void; value: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3.5 py-3 text-[13px] leading-5 text-primary transition-colors has-[:checked]:border-portal-blue has-[:checked]:bg-portal-blue-soft">
    <input aria-label={value} checked={checked} className="mt-1 size-4 accent-[#436C9E]" name={name} onChange={onChange} type="radio" value={value} />
    <span>{children}</span>
  </label>;
}

export function RoleEligibilitySection({ answers, touched, onBlur, onChange }: Props) {
  const relocationError = touched.plannedRelocationDate && answers.abujaAvailability === "relocate" && !answers.plannedRelocationDate ? "Enter your planned relocation date." : "";
  return <section aria-labelledby="role-eligibility-title" className="mt-9 border-t border-border pt-8">
    <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary" id="role-eligibility-title">Role eligibility</h2>
    <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Please confirm the requirements below before continuing with your application.</p>
    <div className="mt-6 space-y-6">
      <FieldFrame error={touched.abujaAvailability && !answers.abujaAvailability ? "Select the option that best describes your availability." : undefined} label="Abuja availability" required>
        <p className="mb-3 text-[13px] leading-5 text-primary">Which statement best describes your current location and availability to work in Abuja?</p>
        <div className="space-y-2">
          <Choice checked={answers.abujaAvailability === "abuja"} name="abuja-availability" onChange={() => onChange("abujaAvailability", "abuja")} value="I currently live in Abuja.">I currently live in Abuja.</Choice>
          <Choice checked={answers.abujaAvailability === "relocate"} name="abuja-availability" onChange={() => onChange("abujaAvailability", "relocate")} value="I do not currently live in Abuja, but I am committed to relocating before the required start date.">I do not currently live in Abuja, but I am committed to relocating before the required start date.</Choice>
          {answers.abujaAvailability === "relocate" ? <div className="ml-7 max-w-xs"><FieldFrame error={relocationError} label="Planned relocation date" required><FoundationInput error={Boolean(relocationError)} onBlur={() => onBlur("plannedRelocationDate")} onChange={(event) => onChange("plannedRelocationDate", event.target.value)} type="date" value={answers.plannedRelocationDate} /></FieldFrame></div> : null}
          <Choice checked={answers.abujaAvailability === "not-relocate"} name="abuja-availability" onChange={() => onChange("abujaAvailability", "not-relocate")} value="I do not live in Abuja and I am not currently planning to relocate.">I do not live in Abuja and I am not currently planning to relocate.</Choice>
        </div>
      </FieldFrame>

      <FieldFrame error={touched.rightToWork && !answers.rightToWork ? "Select an option." : undefined} label="Right to work in Nigeria" required>
        <p className="mb-3 text-[13px] leading-5 text-primary">Do you have the legal right to work in Nigeria?</p>
        <div className="grid gap-2 sm:grid-cols-2"><Choice checked={answers.rightToWork === "yes"} name="right-to-work" onChange={() => onChange("rightToWork", "yes")} value="Yes">Yes</Choice><Choice checked={answers.rightToWork === "no"} name="right-to-work" onChange={() => onChange("rightToWork", "no")} value="No">No</Choice></div>
      </FieldFrame>

      <FieldFrame error={touched.startAvailability && !answers.startAvailability ? "Select an option." : undefined} label="Start availability" required>
        <p className="mb-3 text-[13px] leading-5 text-primary">Are you available to start by 1 September 2026 or earlier?</p>
        <div className="grid gap-2 sm:grid-cols-2"><Choice checked={answers.startAvailability === "yes"} name="start-availability" onChange={() => onChange("startAvailability", "yes")} value="Yes">Yes — I am available to start by 1 September 2026</Choice><Choice checked={answers.startAvailability === "no"} name="start-availability" onChange={() => onChange("startAvailability", "no")} value="No">No — I am not available by that date</Choice></div>
      </FieldFrame>

      <FieldFrame error={touched.compensationBand && !answers.compensationBand ? "Select an option." : undefined} label="Compensation expectation" required>
        <p className="mb-3 text-[13px] leading-5 text-primary">Is your gross annual salary expectation within the range of ₦6,000,000 – ₦9,600,000?</p>
        <div className="grid gap-2 sm:grid-cols-2"><Choice checked={answers.compensationBand === "yes"} name="compensation-band" onChange={() => onChange("compensationBand", "yes")} value="Yes">Yes — within the published band</Choice><Choice checked={answers.compensationBand === "no"} name="compensation-band" onChange={() => onChange("compensationBand", "no")} value="No">No — outside the published band</Choice></div>
      </FieldFrame>

      <FieldFrame error={touched.outboundWork && !answers.outboundWork ? "Select an option." : undefined} label="Outbound work" required>
        <p className="mb-3 text-[13px] leading-5 text-primary">Are you willing to work in an outbound Business Development role that may involve client visits, site tours, evening events and occasional weekend events?</p>
        <div className="grid gap-2 sm:grid-cols-2"><Choice checked={answers.outboundWork === "yes"} name="outbound-work" onChange={() => onChange("outboundWork", "yes")} value="Yes">Yes</Choice><Choice checked={answers.outboundWork === "no"} name="outbound-work" onChange={() => onChange("outboundWork", "no")} value="No">No</Choice></div>
      </FieldFrame>

      <FieldFrame error={touched.verificationConsent && !answers.verificationConsent ? "Select an option." : undefined} label="Reference and employment verification" required>
        <p className="mb-3 text-[13px] leading-5 text-primary">Do you consent to reference and employment verification as part of the recruitment process?</p>
        <div className="grid gap-2 sm:grid-cols-2"><Choice checked={answers.verificationConsent === "yes"} name="verification-consent" onChange={() => onChange("verificationConsent", "yes")} value="Yes">Yes</Choice><Choice checked={answers.verificationConsent === "no"} name="verification-consent" onChange={() => onChange("verificationConsent", "no")} value="No">No</Choice></div>
      </FieldFrame>

      <div className="border-t border-border pt-5"><p className="text-[13px] leading-5 text-primary">Relevant experience</p><p className="mt-1 text-[12px] leading-5 text-muted-foreground">Your professional experience selection above is used to confirm the minimum relevant experience for this role.</p></div>
    </div>
  </section>;
}
