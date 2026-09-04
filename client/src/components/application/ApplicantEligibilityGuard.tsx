import { loadApplicantSession, fetchApplication, ApplicationApiError } from "@/lib/applicationApi";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

/**
 * Task 24D-1: route guard that verifies the applicant has a valid database-backed
 * application with passed eligibility. Redirects to the information step if no
 * session exists, or to the eligibility closeout page if eligibility was closed.
 *
 * The role slug is resolved from the current URL path so this guard works
 * correctly for any recruitment role, not just BDO.
 */
export function ApplicantEligibilityGuard({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [allowed, setAllowed] = useState(false);

  // Resolve the role slug from the current URL: /apply/:roleSlug/...
  const roleSlug = (() => {
    const match = location.match(/^\/apply\/([^/]+)/);
    return match?.[1] ?? "business-development-officer";
  })();

  useEffect(() => {
    const session = loadApplicantSession();
    if (!session) {
      setLocation(`/apply/${roleSlug}/information`);
      return;
    }
    fetchApplication()
      .then((state) => {
        // Session belongs to a different role — clear it and send to information.
        if (state.roleSlug && state.roleSlug !== roleSlug) {
          setLocation(`/apply/${roleSlug}/information`);
          return;
        }
        if (state.eligibilityStatus === "Closed") {
          setLocation(`/apply/${roleSlug}/eligibility`);
        } else if (state.applicationStatus === "Submitted") {
          setLocation(`/apply/${roleSlug}/submitted`);
        } else {
          setAllowed(true);
        }
      })
      .catch((error) => {
        if (error instanceof ApplicationApiError && (error.status === 401 || error.status === 403)) {
          setLocation(`/apply/${roleSlug}/information`);
        } else {
          setAllowed(true);
        }
      });
  }, [setLocation, roleSlug]);

  return allowed ? <>{children}</> : null;
}
