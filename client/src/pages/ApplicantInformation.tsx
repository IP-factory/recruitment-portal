/**
 * Quiet Authority applicant information step: local-only data collection presented in two professional sections without backend connectivity.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FieldFrame, FoundationButton, FoundationInput, FoundationSelect } from "@/components/foundation/ui";
import { type ApplicantInformation, emptyApplicantInformation, loadApplicantInformation, saveApplicantInformation } from "@/lib/applicationData";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);
const totalExperienceOptions = ["Less than 1 year", "1–2 years", "3–5 years", "6–8 years", "9–12 years", "13+ years"];
const businessDevelopmentExperienceOptions = ["No direct experience", "Less than 1 year", "1–2 years", "3–5 years", "6–8 years", "9+ years"];

function getErrors(data: ApplicantInformation) {
  return {
    fullName: data.fullName.trim() ? "" : "Enter your full name.",
    email: validEmail(data.email) ? "" : "Enter a valid email address.",
    phoneNumber: data.phoneNumber.trim() ? "" : "Enter your phone number.",
    location: data.location.trim() ? "" : "Enter your current location.",
    jobTitle: data.jobTitle.trim() ? "" : "Enter your current or most recent job title.",
    totalExperience: data.totalExperience ? "" : "Select your experience level.",
    businessDevelopmentExperience: data.businessDevelopmentExperience ? "" : "Select your experience level.",
  };
}

export default function ApplicantInformation() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<ApplicantInformation>(emptyApplicantInformation);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const errors = useMemo(() => getErrors(data), [data]);
  const formValid = Object.values(errors).every((error) => !error);

  useEffect(() => { setData(loadApplicantInformation()); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) saveApplicantInformation(data); }, [data, hydrated]);
  const updateField = <Key extends keyof ApplicantInformation>(field: Key, value: ApplicantInformation[Key]) => setData((current) => ({ ...current, [field]: value }));
  const markTouched = (field: string) => setTouched((current) => ({ ...current, [field]: true }));
  const errorFor = (field: keyof typeof errors) => touched[field] ? errors[field] : undefined;
  const continueToCv = () => {
    setTouched({ fullName: true, email: true, phoneNumber: true, location: true, jobTitle: true, totalExperience: true, businessDevelopmentExperience: true });
    if (!formValid) return;
    saveApplicantInformation(data);
    setLocation("/apply/business-development-manager/cv");
  };

  return (
    <ApplicationShell activeStep={0} showSummary>
      <section>
        <p className="section-kicker">Step 1 of 4</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Tell us about yourself</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">Provide the basic contact and professional information we need to begin your application.</p>
        <form className="mt-8 rounded-xl border border-border bg-white p-7 shadow-none sm:p-8" onSubmit={(event) => { event.preventDefault(); continueToCv(); }} noValidate>
          <section aria-labelledby="contact-information-title">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary" id="contact-information-title">Contact information</h2>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Tell us how we can identify and contact you during the recruitment process.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <FieldFrame error={errorFor("fullName")} label="Full name" required><FoundationInput error={Boolean(errorFor("fullName"))} onBlur={() => markTouched("fullName")} onChange={(event) => updateField("fullName", event.target.value)} placeholder="Enter your full name" value={data.fullName} /></FieldFrame>
              <FieldFrame error={errorFor("email")} helper="Use an email address you check regularly." label="Email address" required><FoundationInput error={Boolean(errorFor("email"))} onBlur={() => markTouched("email")} onChange={(event) => updateField("email", event.target.value)} placeholder="you@example.com" type="email" value={data.email} /></FieldFrame>
              <FieldFrame error={errorFor("phoneNumber")} label="Phone number" required><FoundationInput error={Boolean(errorFor("phoneNumber"))} onBlur={() => markTouched("phoneNumber")} onChange={(event) => updateField("phoneNumber", event.target.value)} placeholder="Enter your phone number" value={data.phoneNumber} /></FieldFrame>
              <FieldFrame error={errorFor("location")} label="Current city / location" required><FoundationInput error={Boolean(errorFor("location"))} onBlur={() => markTouched("location")} onChange={(event) => updateField("location", event.target.value)} placeholder="e.g. Abuja" value={data.location} /></FieldFrame>
            </div>
          </section>
          <section aria-labelledby="professional-information-title" className="mt-9 border-t border-border pt-8">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary" id="professional-information-title">Professional information</h2>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Give us a brief picture of your current professional background.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><FieldFrame error={errorFor("jobTitle")} label="Current or most recent job title" required><FoundationInput error={Boolean(errorFor("jobTitle"))} onBlur={() => markTouched("jobTitle")} onChange={(event) => updateField("jobTitle", event.target.value)} placeholder="e.g. Business Development Executive" value={data.jobTitle} /></FieldFrame></div>
              <FieldFrame label="Current or most recent employer"><FoundationInput onChange={(event) => updateField("employer", event.target.value)} placeholder="Enter organisation name" value={data.employer} /></FieldFrame>
              <FieldFrame error={errorFor("totalExperience")} label="Total years of professional experience" required><FoundationSelect aria-invalid={Boolean(errorFor("totalExperience"))} className={errorFor("totalExperience") ? "border-status-error-strong" : ""} onBlur={() => markTouched("totalExperience")} onChange={(event) => updateField("totalExperience", event.target.value)} value={data.totalExperience}><option value="">Select experience level</option>{totalExperienceOptions.map((option) => <option key={option} value={option}>{option}</option>)}</FoundationSelect></FieldFrame>
              <div className="sm:col-span-2"><FieldFrame error={errorFor("businessDevelopmentExperience")} label="Years of Business Development or closely related commercial experience" required><FoundationSelect aria-invalid={Boolean(errorFor("businessDevelopmentExperience"))} className={errorFor("businessDevelopmentExperience") ? "border-status-error-strong" : ""} onBlur={() => markTouched("businessDevelopmentExperience")} onChange={(event) => updateField("businessDevelopmentExperience", event.target.value)} value={data.businessDevelopmentExperience}><option value="">Select experience level</option>{businessDevelopmentExperienceOptions.map((option) => <option key={option} value={option}>{option}</option>)}</FoundationSelect></FieldFrame></div>
              <div className="sm:col-span-2"><FieldFrame helper="Optional" label="LinkedIn profile"><FoundationInput onChange={(event) => updateField("linkedInProfile", event.target.value)} placeholder="https://linkedin.com/in/..." value={data.linkedInProfile} /></FieldFrame></div>
            </div>
          </section>
          <div className="mt-9 flex justify-end border-t border-border pt-6"><FoundationButton className="w-full sm:w-auto" disabled={!hydrated} size="lg" type="submit">Continue to CV</FoundationButton></div>
        </form>
      </section>
    </ApplicationShell>
  );
}
