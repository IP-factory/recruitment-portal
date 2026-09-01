import { loadApplicantSession, fetchApplication, ApplicationApiError } from "@/lib/applicationApi";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

/**
 * Task 24D-1: route guard that verifies the applicant has a valid database-backed
 * application with passed eligibility. Redirects to the information step if no
 * session exists, or to the eligibility closeout page if eligibility was closed.
 */
export function ApplicantEligibilityGuard({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const session = loadApplicantSession();
    if (!session) {
      setLocation("/apply/business-development-officer/information");
      return;
    }
    fetchApplication()
      .then((state) => {
        if (state.eligibilityStatus === "Closed") {
          setLocation("/apply/business-development-officer/eligibility");
        } else if (state.applicationStatus === "Submitted") {
          setLocation("/apply/business-development-officer/submitted");
        } else {
          setAllowed(true);
        }
      })
      .catch((error) => {
        if (error instanceof ApplicationApiError && (error.status === 401 || error.status === 403)) {
          setLocation("/apply/business-development-officer/information");
        } else {
          // Allow the page to render — it will handle its own error state
          setAllowed(true);
        }
      });
  }, [setLocation]);
  return allowed ? <>{children}</> : null;
}
