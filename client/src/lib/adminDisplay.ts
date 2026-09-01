/**
 * Admin display wording — Task 24F.
 *
 * Internal application/eligibility status enums stay unchanged in the
 * database and API; these helpers map them to the human-facing labels the
 * Admin UI shows. The only rename is display-level: applicants who failed
 * blocking eligibility requirements appear as "Not Eligible" instead of
 * "Eligibility Closed" / eligibility "Closed".
 */

/** Display label for the persisted eligibility status of an application. */
export function eligibilityDisplayLabel(status: string | null | undefined): string {
  if (!status) return "Pending";
  if (status === "Eligible") return "Eligible";
  if (status === "Closed") return "Not Eligible";
  if (status === "Pending") return "Pending";
  return status;
}

/** Display label for the admin-facing application status. */
export function applicationStatusDisplayLabel(status: string | null | undefined): string {
  if (!status) return "Pending";
  if (status === "Eligibility Closed") return "Not Eligible";
  return status;
}
