import { isApplicantEligibilityClosed } from "@/lib/applicationData";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

export function ApplicantEligibilityGuard({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (isApplicantEligibilityClosed()) setLocation("/apply/business-development-officer/eligibility");
    else setAllowed(true);
  }, [setLocation]);
  return allowed ? <>{children}</> : null;
}
