/**
 * Role eligibility section — rendered dynamically from the role's live gate
 * configuration (Task 24E). No gate copy, dates, or salary values are
 * hard-coded here: everything comes from the server-provided
 * PublicEligibilityGate list. APPLICATION_FIELD gates are skipped because
 * they are derived from the Applicant Information fields.
 */
import { FieldFrame, FoundationInput } from "@/components/foundation/ui";
import type { ApplicantEligibilityAnswers } from "@shared/applicationApi";
import type { PublicEligibilityGate } from "@shared/recruitmentApi";

type Props = {
  gates: PublicEligibilityGate[];
  answers: ApplicantEligibilityAnswers;
  touched: Record<string, boolean>;
  onChange: (gateReference: string, value: string, supplementary?: string) => void;
  onBlur: (field: string) => void;
};

function Choice({ checked, children, name, onChange, value }: { checked: boolean; children: React.ReactNode; name: string; onChange: () => void; value: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3.5 py-3 text-[13px] leading-5 text-primary transition-colors has-[:checked]:border-portal-blue has-[:checked]:bg-portal-blue-soft">
    <input aria-label={value} checked={checked} className="mt-1 size-4 accent-[#436C9E]" name={name} onChange={onChange} type="radio" value={value} />
    <span>{children}</span>
  </label>;
}

/** Derive the applicant-visible question from gate configuration. */
function questionText(gate: PublicEligibilityGate): string {
  if (gate.inputType === "YES_NO") {
    if (gate.deadlineLabel) return `Are you available to start by ${gate.deadlineLabel} or earlier?`;
    if (gate.rangeLabel) return `Is your gross annual salary expectation within the range of ${gate.rangeLabel.replace(" gross per annum", "")}?`;
  }
  return gate.description;
}

function GateField({ gate, answers, touched, onBlur, onChange }: Props & { gate: PublicEligibilityGate }) {
  const answer = answers[gate.reference];
  const missingError = touched[gate.reference] && !answer?.value ? "Select an option." : undefined;

  if (gate.inputType === "YES_NO") {
    return <FieldFrame error={missingError} label={gate.name} required>
      <p className="mb-3 text-[13px] leading-5 text-primary">{questionText(gate)}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Choice checked={answer?.value === "yes"} name={`eligibility-${gate.reference}`} onChange={() => onChange(gate.reference, "yes")} value="Yes">Yes</Choice>
        <Choice checked={answer?.value === "no"} name={`eligibility-${gate.reference}`} onChange={() => onChange(gate.reference, "no")} value="No">No</Choice>
      </div>
    </FieldFrame>;
  }

  if (gate.inputType === "SINGLE_SELECT" && Array.isArray(gate.options)) {
    const supplementaryVisible = gate.allowSupplementaryField
      && gate.supplementaryFieldVisibleWhen
      && answer?.value === gate.supplementaryFieldVisibleWhen;
    const supplementaryKey = gate.supplementaryFieldKey ?? `supplementary-${gate.reference}`;
    const supplementaryError = supplementaryVisible && touched[supplementaryKey] && !answer?.supplementary ? `Enter your ${gate.supplementaryFieldLabel?.toLowerCase() ?? "follow-up answer"}.` : "";
    return <FieldFrame error={missingError} label={gate.name} required>
      <p className="mb-3 text-[13px] leading-5 text-primary">{questionText(gate)}</p>
      <div className="space-y-2">
        {gate.options.map((option) => <Choice checked={answer?.value === option.value} key={option.value} name={`eligibility-${gate.reference}`} onChange={() => onChange(gate.reference, option.value)} value={option.text}>{option.text}</Choice>)}
      </div>
      {supplementaryVisible ? <div className="ml-7 mt-3 max-w-xs"><FieldFrame error={supplementaryError} label={gate.supplementaryFieldLabel ?? "Additional detail"} required><FoundationInput error={Boolean(supplementaryError)} onBlur={() => onBlur(supplementaryKey)} onChange={(event) => onChange(gate.reference, answer?.value ?? "", event.target.value)} type="date" value={answer?.supplementary ?? ""} /></FieldFrame></div> : null}
    </FieldFrame>;
  }

  // Unsupported / misconfigured gates are not rendered to the applicant; the
  // server remains authoritative and will report their state.
  return null;
}

export function RoleEligibilitySection({ answers, gates, onBlur, onChange, touched }: Props) {
  const visibleGates = gates.filter((gate) => gate.status === "Active" && gate.inputType && gate.inputType !== "APPLICATION_FIELD");
  const derivedGates = gates.filter((gate) => gate.status === "Active" && gate.inputType === "APPLICATION_FIELD");
  return <section aria-labelledby="role-eligibility-title" className="mt-9 border-t border-border pt-8">
    <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary" id="role-eligibility-title">Role eligibility</h2>
    <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Please confirm the requirements below before continuing with your application.</p>
    <div className="mt-6 space-y-6">
      {visibleGates.map((gate) => <GateField answers={answers} gate={gate} gates={gates} key={gate.reference} onBlur={onBlur} onChange={onChange} touched={touched} />)}
      {derivedGates.length ? <div className="border-t border-border pt-5"><p className="text-[13px] leading-5 text-primary">Relevant experience</p><p className="mt-1 text-[12px] leading-5 text-muted-foreground">Your professional experience selection above is used to confirm the minimum relevant experience for this role.</p></div> : null}
    </div>
  </section>;
}
