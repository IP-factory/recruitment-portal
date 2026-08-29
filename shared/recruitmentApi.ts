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
export const GATE_INPUT_TYPES = ["YES_NO", "SINGLE_SELECT", "APPLICATION_FIELD", "DATE", "COMPENSATION", "FREE_TEXT"] as const;

export type RoleStatus = (typeof ROLE_STATUSES)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type GateStatus = (typeof GATE_STATUSES)[number];
export type GateInputType = (typeof GATE_INPUT_TYPES)[number];

// ── Generic eligibility gate configuration ───────────────────────────────────
//
// Every gate's `configuration` JSON in the database conforms to this shape. The
// evaluator dispatches on `inputType`, never on `reference`, so any role may
// declare any set of gates. BDO currently uses G1-G7; a future role may
// declare four gates or twelve and nothing in the evaluator hard-codes the
// reference strings.

export interface EligibilityGateOption {
  value: string;
  text: string;
  /** Outcome for this option: PASS, FAIL, or PASS_WITH_FLAG. */
  outcome: "PASS" | "FAIL" | "PASS_WITH_FLAG";
  /** Optional internal flag label recorded when outcome is PASS_WITH_FLAG. */
  flag?: string;
}

export interface EligibilityGatePassRule {
  /** For YES_NO / SINGLE_SELECT with no explicit options outcome, the value that means PASS. */
  match?: string;
}

export interface EligibilityGateConfiguration {
  /** Dispatcher used by the evaluator — never switch on `reference`. */
  inputType: GateInputType;
  /** Display label for the applicant form or Admin editor. */
  label: string;
  /** Optional structured description shown under the label. */
  description?: string;
  /** Options for SINGLE_SELECT input. YES_NO renders its own two-option set. */
  options?: EligibilityGateOption[];
  /** Simple pass-rule for YES_NO (e.g. {match:"yes"}). */
  passRule?: EligibilityGatePassRule;
  /** Whether failing this gate closes the application. */
  isBlocking: boolean;

  // ── APPLICATION_FIELD (derived from applicant information) ──
  /** The applicant-information field key this gate derives from (e.g. "relevantExperience"). */
  fieldKey?: string;
  /** Minimum years required — used for experience-derived gates. */
  minimumYears?: number;
  /** Map from experience band label to represented minimum years. */
  experienceBandMinimumYears?: Record<string, number>;

  // ── DATE / availability ──
  /** ISO date (YYYY-MM-DD) of the configured deadline. */
  latestStartDate?: string;
  /** Human-readable deadline label. */
  deadlineLabel?: string;

  // ── COMPENSATION / range ──
  /** Minimum gross amount. */
  minimumAmount?: number;
  /** Maximum gross amount. */
  maximumAmount?: number;
  /** ISO currency code. */
  currency?: string;
  /** Pay period label (e.g. "gross annual"). */
  period?: string;
  /** Pre-rendered range label (e.g. "₦6,000,000 – ₦9,600,000 gross per annum"). */
  rangeLabel?: string;

  // ── SINGLE_SELECT with supplementary follow-up ──
  /** When true, the applicant form renders an additional field (e.g. relocation date). */
  allowSupplementaryField?: boolean;
  /** The key used in eligibility answers for the supplementary value. */
  supplementaryFieldKey?: string;
  /** Label for the supplementary field. */
  supplementaryFieldLabel?: string;
  /** Parent option value that reveals the supplementary field. */
  supplementaryFieldVisibleWhen?: string;
}

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

/** Applicant-safe option wording — pass/fail outcomes are never exposed. */
export interface PublicEligibilityGateOption {
  value: string;
  text: string;
}

/** Applicant-safe gate summary: wording, state, and rendering hints only, no scoring. */
export interface PublicEligibilityGate {
  reference: string;
  name: string;
  description: string;
  gateType: string;
  status: GateStatus;
  /** Dispatcher used by the applicant form to pick the right widget. */
  inputType?: GateInputType;
  /** Options for SINGLE_SELECT gates (YES_NO is rendered from the dispatcher). */
  options?: PublicEligibilityGateOption[];
  /** Whether the gate is blocking (shown to the applicant for context only). */
  isBlocking?: boolean;
  /** Supplementary follow-up field configuration (e.g. planned relocation date). */
  allowSupplementaryField?: boolean;
  supplementaryFieldKey?: string;
  supplementaryFieldLabel?: string;
  supplementaryFieldVisibleWhen?: string;
  /** Date / availability configuration (server-rendered labels). */
  latestStartDate?: string;
  deadlineLabel?: string;
  /** Compensation / range configuration (server-rendered labels). */
  minimumAmount?: number;
  maximumAmount?: number;
  currency?: string;
  period?: string;
  rangeLabel?: string;
  /** Experience-derived minimum (G3 for BDO). */
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
  id: string;
  reference: string;
  name: string;
  description: string;
  gateType: string;
  status: GateStatus;
  displayOrder: number;
  configuration: EligibilityGateConfiguration;
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
export function deriveEligibilityGateSummary(gates: Array<{ status: string; configuration?: unknown }>): EligibilityGateSummary {
  return {
    totalCount: gates.length,
    activeCount: gates.filter((gate) => gate.status === "Active").length,
    configurationRequiredCount: gates.filter((gate) => gate.status === "Configuration Required").length,
  };
}

/** Human-readable readiness label derived from live gate configuration. */
export function describeEligibilityGateSummary(summary: EligibilityGateSummary): string {
  if (summary.totalCount === 0) return "No gates configured";
  if (summary.configurationRequiredCount > 0) {
    return `${summary.activeCount} active gates · ${summary.configurationRequiredCount} configuration required`;
  }
  return `${summary.activeCount} active gates · Fully configured`;
}

// ── Eligibility gate create/update validation (server-authoritative) ────────

export interface EligibilityGateInput {
  reference: string;
  name: string;
  description: string;
  status: GateStatus;
  displayOrder: number;
  configuration: EligibilityGateConfiguration;
}

/**
 * Validate an Admin eligibility gate payload server-side. Returns the
 * sanitized input or safe validation error messages — never raw details.
 */
export function validateEligibilityGateInput(candidate: unknown): { input: EligibilityGateInput } | { errors: string[] } {
  if (!candidate || typeof candidate !== "object") return { errors: ["Gate data is missing."] };
  const value = candidate as Record<string, unknown>;
  const errors: string[] = [];

  const reference = typeof value.reference === "string" ? value.reference.trim() : "";
  if (!reference) errors.push("Enter a gate code.");
  else if (reference.length > 16) errors.push("Gate code is too long.");

  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) errors.push("Enter a display label.");
  else if (name.length > 180) errors.push("Display label is too long.");

  const description = typeof value.description === "string" ? value.description.trim() : "";
  if (!description) errors.push("Enter the question text.");

  const status = value.status;
  if (typeof status !== "string" || !(GATE_STATUSES as readonly string[]).includes(status)) errors.push("Select a valid gate status.");

  const displayOrder = typeof value.displayOrder === "number" && Number.isFinite(value.displayOrder) ? Math.round(value.displayOrder) : Number.NaN;
  if (Number.isNaN(displayOrder) || displayOrder < 1) errors.push("Enter a valid display order.");

  const configuration = value.configuration;
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    errors.push("Gate configuration is missing.");
  } else {
    const config = configuration as Record<string, unknown>;
    const inputType = config.inputType;
    if (typeof inputType !== "string" || !(GATE_INPUT_TYPES as readonly string[]).includes(inputType)) {
      errors.push("Select a valid input type.");
    } else if (inputType === "SINGLE_SELECT") {
      const options = Array.isArray(config.options) ? config.options : [];
      if (options.length === 0) errors.push("Single-select gates require at least one option.");
      options.forEach((option, index) => {
        if (!option || typeof option !== "object") {
          errors.push(`Option ${index + 1} is invalid.`);
          return;
        }
        const opt = option as Record<string, unknown>;
        if (typeof opt.value !== "string" || !opt.value.trim()) errors.push(`Option ${index + 1} needs a value.`);
        if (typeof opt.text !== "string" || !opt.text.trim()) errors.push(`Option ${index + 1} needs display text.`);
        if (typeof opt.outcome !== "string" || !["PASS", "FAIL", "PASS_WITH_FLAG"].includes(opt.outcome)) errors.push(`Option ${index + 1} needs a pass/fail outcome.`);
      });
    } else if (inputType === "APPLICATION_FIELD") {
      if (typeof config.fieldKey !== "string" || !config.fieldKey.trim()) errors.push("Derived gates must declare the applicant field they read.");
    }
    if (typeof config.isBlocking !== "boolean") errors.push("Declare whether the gate is blocking.");
  }

  if (errors.length) return { errors };
  return {
    input: {
      reference,
      name,
      description,
      status: status as GateStatus,
      displayOrder,
      configuration: configuration as EligibilityGateConfiguration,
    },
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
