/**
 * Task 24F — submission outcome resolution for the `/submitted` route.
 *
 * The outcome page must branch on the actual persisted application state:
 * - ineligible applications receive the professional "Not Eligible" outcome
 * - eligible submitted applications receive the normal success confirmation
 * - anything else is redirected back into the application flow
 *
 * Pure and dependency-free so the branching rules are directly testable.
 */

export type SubmissionOutcomeKind = "not-eligible" | "submitted" | "in-progress" | "no-session";

export interface SubmissionOutcomeInput {
  hasSession: boolean;
  eligibilityStatus?: string | null;
  applicationStatus?: string | null;
}

export interface SubmissionOutcome {
  kind: SubmissionOutcomeKind;
  /** Present when the applicant should be redirected somewhere else. */
  redirect?: string;
}

export const SUBMISSION_ROUTE_BASE = "/apply/business-development-officer";

export function resolveSubmissionOutcome(input: SubmissionOutcomeInput): SubmissionOutcome {
  if (!input.hasSession) {
    return { kind: "no-session", redirect: SUBMISSION_ROUTE_BASE };
  }
  // Ineligibility wins over any other status: the applicant must always see
  // the outcome screen rather than a blank page or a success confirmation.
  if (input.eligibilityStatus === "Closed") {
    return { kind: "not-eligible" };
  }
  if (input.applicationStatus === "Submitted") {
    return { kind: "submitted" };
  }
  return { kind: "in-progress", redirect: `${SUBMISSION_ROUTE_BASE}/review` };
}
