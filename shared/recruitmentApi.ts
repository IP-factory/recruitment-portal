/**
 * Task 24C-1 — shared Recruitment API contract.
 *
 * Pure DTO types and deterministic helpers shared by the Express API, the
 * client API module, and the tests. Public shapes are applicant-safe: they
 * never carry dimension weights, floors, screening bands, verification
 * multipliers, integrity penalties, bonus configuration, or database IDs.
 */

export const ROLE_STATUSES = ["Draft", "Open", "Closed", "Archived"] as const;
export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"] as const;
export const GATE_STATUSES = ["Active", "Configuration Required", "Inactive"] as const;

export type RoleStatus = (typeof ROLE_STATUSES)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type GateStatus = (typeof GATE_STATUSES)[number];

// ── Public (applicant-safe) shapes ───────────────────────────────────────────

export interface PublicRecruitmentRole {
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  shortDescription: string;
  fullDescription: string;
  status: RoleStatus;
  openingDate: string | null;
  closingDate: string | null;
}

/** Applicant-safe gate summary: question wording and state only, no scoring. */
export interface PublicEligibilityGate {
  reference: string;
  name: string;
  description: string;
  gateType: string;
  status: GateStatus;
  /** Present only where the applicant UX needs it (e.g. G3 minimum years). */
  minimumYears?: number;
}

export interface PublicEligibilityConfiguration {
  roleSlug: string;
  gates: PublicEligibilityGate[];
  summary: EligibilityGateSummary;
}

export interface EligibilityGateSummary {
  totalCount: number;
  activeCount: number;
  configurationRequiredCount: number;
}

// ── Admin shapes ─────────────────────────────────────────────────────────────

export interface AdminRecruitmentRole extends PublicRecruitmentRole {
  id: string;
  updatedAt: string;
}

export interface AdminEligibilityGate {
  reference: string;
  name: string;
  description: string;
  gateType: string;
  status: GateStatus;
  displayOrder: number;
  configuration: Record<string, unknown>;
}

export interface EvaluationFrameworkDimension {
  reference: string;
  name: string;
  weight: number;
  minimumFloor: number | null;
  displayOrder: number;
  status: "Active" | "Inactive";
}

export interface ScreeningVerificationEntry {
  code: string;
  label: string;
  multiplier: number;
}

export interface ScreeningBonusEntry {
  code: string;
  label: string;
  points: number;
}

export interface ScreeningBandEntry {
  band: "A" | "B" | "C" | "D";
  minimumScore: number;
  maximumScore: number | null;
  label: string;
}

export interface EvaluationFrameworkConfiguration {
  roleId: string;
  dimensions: EvaluationFrameworkDimension[];
  totalWeight: number;
  screening: {
    integrityPenalty: number;
    bonusCap: number;
    verification: ScreeningVerificationEntry[];
    bonusItems: ScreeningBonusEntry[];
    bands: ScreeningBandEntry[];
    manualReviewRules: Record<string, unknown>;
  } | null;
}

// ── Role create/update input validation (server-authoritative) ──────────────

export interface RecruitmentRoleInput {
  title: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  shortDescription: string;
  fullDescription: string;
  status: RoleStatus;
  openingDate: string | null;
  closingDate: string | null;
}

export const RECRUITMENT_ROLE_INPUT_FIELDS: Array<keyof RecruitmentRoleInput> = [
  "title",
  "department",
  "location",
  "employmentType",
  "shortDescription",
  "fullDescription",
  "status",
  "openingDate",
  "closingDate",
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

/**
 * Validate role metadata server-side; never trust the client alone. Returns
 * the sanitized input or a list of safe validation error messages.
 */
export function validateRecruitmentRoleInput(candidate: unknown): { input: RecruitmentRoleInput } | { errors: string[] } {
  if (!candidate || typeof candidate !== "object") return { errors: ["Role data is missing."] };
  const value = candidate as Record<string, unknown>;
  const errors: string[] = [];
  const trimmed = (key: string) => (typeof value[key] === "string" ? value[key].trim() : "");

  const title = trimmed("title");
  if (!title) errors.push("Enter a role title.");
  else if (title.length > 180) errors.push("Role title is too long.");
  const department = trimmed("department");
  if (!department) errors.push("Enter a department.");
  else if (department.length > 160) errors.push("Department is too long.");
  const location = trimmed("location");
  if (!location) errors.push("Enter a location.");
  else if (location.length > 160) errors.push("Location is too long.");
  const employmentType = value.employmentType;
  if (typeof employmentType !== "string" || !(EMPLOYMENT_TYPES as readonly string[]).includes(employmentType)) errors.push("Select a valid employment type.");
  const shortDescription = trimmed("shortDescription");
  if (!shortDescription) errors.push("Enter a short role description.");
  const fullDescription = typeof value.fullDescription === "string" ? value.fullDescription.trim() : "";
  const status = value.status;
  if (typeof status !== "string" || !(ROLE_STATUSES as readonly string[]).includes(status)) errors.push("Select a valid role status.");

  const openingDate = value.openingDate === "" || value.openingDate == null ? null : value.openingDate;
  const closingDate = value.closingDate === "" || value.closingDate == null ? null : value.closingDate;
  if (openingDate !== null && (typeof openingDate !== "string" || !isValidDateString(openingDate))) errors.push("The opening date is not valid.");
  if (closingDate !== null && (typeof closingDate !== "string" || !isValidDateString(closingDate))) errors.push("The closing date is not valid.");
  if (typeof openingDate === "string" && typeof closingDate === "string" && closingDate < openingDate) errors.push("Closing date must be after the opening date.");

  if (errors.length) return { errors };
  return {
    input: {
      title,
      department,
      location,
      employmentType: employmentType as EmploymentType,
      shortDescription,
      fullDescription,
      status: status as RoleStatus,
      openingDate: openingDate as string | null,
      closingDate: closingDate as string | null,
    },
  };
}

/** Stable URL slug from a role title. */
export function slugifyRoleTitle(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "recruitment-role";
}

/** Pick the first free slug variant: base, base-2, base-3, ... */
export function resolveUniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Unable to allocate a unique slug");
}

/** Derive the restrained gate summary shown in the Admin role overview. */
export function deriveEligibilityGateSummary(gates: Array<{ status: string }>): EligibilityGateSummary {
  return {
    totalCount: gates.length,
    activeCount: gates.filter((gate) => gate.status === "Active").length,
    configurationRequiredCount: gates.filter((gate) => gate.status === "Configuration Required").length,
  };
}

/** Human-readable band range matching the approved Evaluation Framework copy. */
export function describeScreeningBandRange(band: ScreeningBandEntry): string {
  const minimum = Math.round(band.minimumScore);
  if (band.band === "D") return "Below 50";
  const maximum = band.maximumScore !== null ? Math.floor(band.maximumScore) : 100;
  return `${minimum}–${maximum}`;
}

/** Format an ISO timestamp as the restrained "26 Aug 2026" label. */
export function formatRoleUpdatedLabel(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Null-safe date label for the Admin role views ("Not set" when absent). */
export function formatRoleDateLabel(value: string | null): string {
  return value ? formatRoleUpdatedLabel(value) : "Not set";
}
