/**
 * Task 24D-1 — applicant information step with real server-side persistence.
 *
 * On submit, creates a database-backed application via POST /api/public/applications.
 * Server evaluates eligibility server-side and returns the application token.
 * On success, stores the token in localStorage and navigates to the next step.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { RoleEligibilitySection } from "@/components/application/RoleEligibilitySection";
import { DataErrorState } from "@/components/AsyncStates";
import { FieldFrame, FoundationButton, FoundationInput, FoundationSelect } from "@/components/foundation/ui";
import { usePublicEligibility } from "@/hooks/useRecruitmentData";
import { BUSINESS_DEVELOPMENT_OFFICER_ROUTE } from "@/lib/eligibilityData";
import { createApplication, saveApplicantSession, loadApplicantSession, fetchApplication, ApplicationApiError, clearApplicantSession } from "@/lib/applicationApi";
import type { ApplicantEligibilityAnswers, CreateApplicationInput } from "@shared/applicationApi";
import { CURRENT_STATUS_OPTIONS, emptyApplicantInformation, type ApplicantInformation } from "@/lib/applicationData";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

const totalExperienceOptions = [
  "Less than 1 year",
  "1–2 years",
  "3–5 years",
  "6–8 years",
  "9–12 years",
  "13+ years",
];

function getErrors(data: ApplicantInformation) {
  return {
    fullName: data.fullName.trim() ? "" : "Enter your full name.",
    email: validEmail(data.email) ? "" : "Enter a valid email address.",
    phoneNumber: data.phoneNumber.trim() ? "" : "Enter your phone number.",
    location: data.location.trim() ? "" : "Enter your current location.",
    currentStatus: data.currentStatus ? "" : "Select your current status.",
    otherStatusText: data.currentStatus === "Other" && !data.otherStatusText.trim() ? "Specify your current status." : "",
    totalExperience: data.totalExperience ? "" : "Select your experience level.",
  };
}

export default function ApplicantInformation() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<ApplicantInformation>(emptyApplicantInformation);
  const [eligibility, setEligibility] = useState<ApplicantEligibilityAnswers>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = useMemo(() => getErrors(data), [data]);
  const formValid = Object.values(errors).every((e) => !e);

  // Gate configuration for this specific role, loaded from TiDB. The slug is
  // resolved from the URL so each /apply/:roleSlug page loads its own gates.
  const roleSlug = useMemo(() => {
    if (typeof window === "undefined") return BUSINESS_DEVELOPMENT_OFFICER_ROUTE;
    const match = window.location.pathname.match(/^\/apply\/([^/]+)/);
    return match?.[1] || BUSINESS_DEVELOPMENT_OFFICER_ROUTE;
  }, []);

  const gateConfiguration = usePublicEligibility(roleSlug);
  const eligibilityGates = useMemo(() => {
    if (gateConfiguration.status !== "ready" || !gateConfiguration.data) return [];
    return gateConfiguration.data.gates;
  }, [gateConfiguration.status, gateConfiguration.data]);
  const configurationUnavailable = gateConfiguration.status === "error" || (gateConfiguration.status === "ready" && eligibilityGates.length === 0);

  // Load persisted local form state for UX convenience
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("recruitment-portal:bdm:applicant-information");
      if (stored) setData({ ...emptyApplicantInformation, ...JSON.parse(stored) });
      const eligStored = window.localStorage.getItem("recruitment-portal:bdm:eligibility-answers");
      if (eligStored) setEligibility(JSON.parse(eligStored) as ApplicantEligibilityAnswers);
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Check for existing application session and resume only if it's for THIS role.
  // If the existing session belongs to a different role, clear it so the user
  // can start a fresh application for the role they're currently viewing.
  useEffect(() => {
    const session = loadApplicantSession();
    if (session) {
      fetchApplication()
        .then((state) => {
          // Wrong role — clear stale session and let the user start fresh.
          if (state.roleSlug && state.roleSlug !== roleSlug) {
            clearApplicantSession();
            return;
          }
          // Same role — resume at the appropriate step.
          if (state.eligibilityStatus === "Closed") {
            setLocation(`/apply/${roleSlug}/eligibility`);
          } else if (state.applicationStatus === "Submitted") {
            setLocation(`/apply/${roleSlug}/submitted`);
          } else if (state.applicationStatus === "Assessment Complete") {
            setLocation(`/apply/${roleSlug}/review`);
          } else {
            setLocation(`/apply/${roleSlug}/cv`);
          }
        })
        .catch((err) => {
          if (err instanceof ApplicationApiError && (err.status === 401 || err.status === 403)) {
            clearApplicantSession();
          }
        });
    }
  }, [setLocation, roleSlug]);

  const updateField = <Key extends keyof ApplicantInformation>(field: Key, value: ApplicantInformation[Key]) =>
    setData((current) => ({ ...current, [field]: value }));

  const updateEligibility = (gateReference: string, value: string, supplementary?: string) =>
    setEligibility((current) => ({
      ...current,
      [gateReference]: {
        value,
        ...(supplementary !== undefined
          ? { supplementary }
          : current[gateReference]?.supplementary
            ? { supplementary: current[gateReference].supplementary }
            : {}),
      },
    }));

  const markTouched = (field: string) => setTouched((current) => ({ ...current, [field]: true }));
  const errorFor = (field: keyof typeof errors) => touched[field] ? errors[field] : undefined;

  // Gates that require an applicant answer (APPLICATION_FIELD gates are
  // derived from the information payload and never collect a form answer here).
  const answerRequiredGates = useMemo(
    () => eligibilityGates.filter((gate) => gate.status === "Active" && gate.inputType && gate.inputType !== "APPLICATION_FIELD"),
    [eligibilityGates],
  );
  const eligibilityComplete = answerRequiredGates.every((gate) => {
    const answer = eligibility[gate.reference];
    if (!answer?.value) return false;
    if (gate.allowSupplementaryField && gate.supplementaryFieldVisibleWhen === answer.value && !answer.supplementary) return false;
    return true;
  });

  const continueToCV = async () => {
    // Mark every required field as touched so inline errors surface immediately
    const allTouched: Record<string, boolean> = {
      fullName: true, email: true, phoneNumber: true, location: true,
      currentStatus: true, otherStatusText: true, totalExperience: true,
    };
    for (const gate of answerRequiredGates) {
      allTouched[gate.reference] = true;
      if (gate.supplementaryFieldKey) allTouched[gate.supplementaryFieldKey] = true;
    }
    setTouched(allTouched);

    if (!formValid || eligibilityGates.length === 0) return;
    if (!eligibilityComplete) return;

    setSubmitting(true);
    setError(null);

    const input: CreateApplicationInput = {
      roleSlug,
      fullName: data.fullName.trim(),
      email: data.email.trim(),
      phone: data.phoneNumber.trim(),
      city: data.location.trim(),
      currentStatus: data.currentStatus,
      currentStatusOther: data.currentStatus === "Other" ? data.otherStatusText.trim() : "",
      totalExperience: data.totalExperience,
      // relevantExperience is no longer collected here — BD experience is now
      // a live eligibility gate answer evaluated server-side.
      relevantExperience: "",
      linkedinUrl: data.linkedInProfile.trim(),
      eligibility,
    };

    try {
      const result = await createApplication(input);
      saveApplicantSession(result.applicationId, result.applicantToken);

      // Save local form state as UX backup (not source of truth)
      if (typeof window !== "undefined") {
        window.localStorage.setItem("recruitment-portal:bdm:applicant-information", JSON.stringify(data));
        window.localStorage.setItem("recruitment-portal:bdm:eligibility-answers", JSON.stringify(eligibility));
      }

      if (result.nextStep === "eligibility-closed") {
        setLocation(`/apply/${roleSlug}/eligibility`);
      } else {
        setLocation(`/apply/${roleSlug}/cv`);
      }
    } catch (err) {
      setError(err instanceof ApplicationApiError ? err.message : "Unable to create your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ApplicationShell activeStep={0} showSummary>
      <section>
        <p className="section-kicker">Step 1 of 4</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Tell us about yourself</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">Provide the basic contact and professional information we need to begin your application.</p>

        <form
          className="mt-8 rounded-xl border border-border bg-white p-7 shadow-none sm:p-8"
          noValidate
          onSubmit={(event) => { event.preventDefault(); void continueToCV(); }}
        >
          {/* ── Contact information ────────────────────────────────────────── */}
          <section aria-labelledby="contact-information-title">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary" id="contact-information-title">Contact information</h2>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Tell us how we can identify and contact you during the recruitment process.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <FieldFrame error={errorFor("fullName")} label="Full name" required>
                <FoundationInput error={Boolean(errorFor("fullName"))} onBlur={() => markTouched("fullName")} onChange={(e) => updateField("fullName", e.target.value)} placeholder="Enter your full name" value={data.fullName} />
              </FieldFrame>
              <FieldFrame error={errorFor("email")} helper="Use an email address you check regularly." label="Email address" required>
                <FoundationInput error={Boolean(errorFor("email"))} onBlur={() => markTouched("email")} onChange={(e) => updateField("email", e.target.value)} placeholder="you@example.com" type="email" value={data.email} />
              </FieldFrame>
              <FieldFrame error={errorFor("phoneNumber")} label="Phone number" required>
                <FoundationInput error={Boolean(errorFor("phoneNumber"))} onBlur={() => markTouched("phoneNumber")} onChange={(e) => updateField("phoneNumber", e.target.value)} placeholder="Enter your phone number" value={data.phoneNumber} />
              </FieldFrame>
              <FieldFrame error={errorFor("location")} label="Current city / location" required>
                <FoundationInput error={Boolean(errorFor("location"))} onBlur={() => markTouched("location")} onChange={(e) => updateField("location", e.target.value)} placeholder="e.g. Abuja" value={data.location} />
              </FieldFrame>
            </div>
          </section>

          {/* ── Professional information ───────────────────────────────────── */}
          <section aria-labelledby="professional-information-title" className="mt-9 border-t border-border pt-8">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary" id="professional-information-title">Professional information</h2>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Give us a brief picture of your current professional background.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              {/* Current status replaces old job-title + employer fields */}
              <div className="sm:col-span-2">
                <FieldFrame error={errorFor("currentStatus")} label="Current status" required>
                  <FoundationSelect
                    aria-invalid={Boolean(errorFor("currentStatus"))}
                    className={errorFor("currentStatus") ? "border-status-error-strong" : ""}
                    onBlur={() => markTouched("currentStatus")}
                    onChange={(e) => {
                      updateField("currentStatus", e.target.value);
                      // Clear the Other text when switching away from "Other"
                      if (e.target.value !== "Other") updateField("otherStatusText", "");
                    }}
                    value={data.currentStatus}
                  >
                    <option value="">Select your current status</option>
                    {CURRENT_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </FoundationSelect>
                </FieldFrame>
              </div>

              {/* Conditional "Please specify" — only visible when Other is selected */}
              {data.currentStatus === "Other" && (
                <div className="sm:col-span-2">
                  <FieldFrame error={errorFor("otherStatusText")} label="Please specify" required>
                    <FoundationInput
                      error={Boolean(errorFor("otherStatusText"))}
                      onBlur={() => markTouched("otherStatusText")}
                      onChange={(e) => updateField("otherStatusText", e.target.value)}
                      placeholder="Describe your current situation"
                      value={data.otherStatusText}
                    />
                  </FieldFrame>
                </div>
              )}

              <FieldFrame error={errorFor("totalExperience")} label="Total years of professional experience" required>
                <FoundationSelect
                  aria-invalid={Boolean(errorFor("totalExperience"))}
                  className={errorFor("totalExperience") ? "border-status-error-strong" : ""}
                  onBlur={() => markTouched("totalExperience")}
                  onChange={(e) => updateField("totalExperience", e.target.value)}
                  value={data.totalExperience}
                >
                  <option value="">Select experience level</option>
                  {totalExperienceOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </FoundationSelect>
              </FieldFrame>

              <div>
                <FieldFrame helper="Optional" label="LinkedIn profile">
                  <FoundationInput onChange={(e) => updateField("linkedInProfile", e.target.value)} placeholder="https://linkedin.com/in/..." value={data.linkedInProfile} />
                </FieldFrame>
              </div>
            </div>
          </section>

          {/* ── Role eligibility section (gate-driven) ─────────────────────── */}
          <RoleEligibilitySection
            answers={eligibility}
            gates={eligibilityGates}
            onBlur={markTouched}
            onChange={updateEligibility}
            touched={touched}
          />

          {error && (
            <div className="mt-6 rounded-lg border border-status-error-strong bg-status-error-soft px-4 py-3 text-sm text-status-error-strong">{error}</div>
          )}

          {configurationUnavailable ? (
            <div className="mt-9 border-t border-border pt-6">
              <DataErrorState message={gateConfiguration.error ?? "The role eligibility configuration could not be loaded."} onRetry={gateConfiguration.reload} />
            </div>
          ) : (
            <div className="mt-9 flex justify-end border-t border-border pt-6">
              <FoundationButton
                className="w-full sm:w-auto"
                disabled={!hydrated || submitting || gateConfiguration.status === "loading" || eligibilityGates.length === 0}
                size="lg"
                type="submit"
              >
                {submitting ? "Submitting..." : "Continue to CV"}
              </FoundationButton>
            </div>
          )}
        </form>
      </section>
    </ApplicationShell>
  );
}
