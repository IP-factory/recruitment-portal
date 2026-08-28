/**
 * Task 24C-1 — recruitment repository layer.
 *
 * Reusable, testable TiDB access for the three cut-over domains (Recruitment
 * Role, Eligibility configuration, Evaluation Framework). Express handlers use
 * these functions instead of embedding Drizzle queries directly.
 */
import { randomBytes } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import {
  assessmentDimensions,
  eligibilityGates,
  recruitmentRoles,
  screeningBands,
  screeningBonusCriteria,
  screeningConfigurations,
  screeningVerificationMultipliers,
} from "../drizzle/schema";
import {
  resolveUniqueSlug,
  slugifyRoleTitle,
  type AdminEligibilityGate,
  type AdminRecruitmentRole,
  type EmploymentType,
  type EvaluationFrameworkConfiguration,
  type PublicEligibilityConfiguration,
  type PublicEligibilityGate,
  type PublicRecruitmentRole,
  type RecruitmentRoleInput,
} from "../shared/recruitmentApi";
import { getDatabase } from "./db";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const decimalToNumber = (value: string | number | null): number | null => (value === null ? null : Number(value));

// ── Role records ─────────────────────────────────────────────────────────────

export async function listRecruitmentRoles() {
  const db = getDatabase();
  return db.select().from(recruitmentRoles).orderBy(asc(recruitmentRoles.createdAt));
}

export async function getRecruitmentRoleById(id: string) {
  const db = getDatabase();
  return (await db.select().from(recruitmentRoles).where(eq(recruitmentRoles.id, id)).limit(1))[0] ?? null;
}

export async function getRecruitmentRoleBySlug(slug: string) {
  const db = getDatabase();
  return (await db.select().from(recruitmentRoles).where(eq(recruitmentRoles.slug, slug)).limit(1))[0] ?? null;
}

/** Resolve an Admin route parameter that may be a database id or a slug. */
export async function getRecruitmentRoleByIdOrSlug(idOrSlug: string) {
  return (await getRecruitmentRoleById(idOrSlug)) ?? (await getRecruitmentRoleBySlug(idOrSlug));
}

export async function createRecruitmentRole(input: RecruitmentRoleInput): Promise<AdminRecruitmentRole> {
  const db = getDatabase();
  const existing = await db.select({ slug: recruitmentRoles.slug }).from(recruitmentRoles);
  const slug = resolveUniqueSlug(slugifyRoleTitle(input.title), new Set(existing.map((row) => row.slug)));
  const id = `role-${randomBytes(12).toString("hex")}`;
  await db.insert(recruitmentRoles).values({ id, slug, ...input, fullDescription: input.fullDescription || "" });
  const created = await getRecruitmentRoleById(id);
  if (!created) throw new Error("Role insert did not complete");
  return toAdminRole(created);
}

export async function updateRecruitmentRole(id: string, input: RecruitmentRoleInput): Promise<AdminRecruitmentRole | null> {
  const db = getDatabase();
  const existing = await getRecruitmentRoleById(id);
  if (!existing) return null;
  // Metadata-only update: gates, dimensions, assessments and screening
  // configuration are never touched by an ordinary role edit.
  await db.update(recruitmentRoles).set({ ...input, fullDescription: input.fullDescription || "" }).where(eq(recruitmentRoles.id, id));
  const updated = await getRecruitmentRoleById(id);
  return updated ? toAdminRole(updated) : null;
}

export function toAdminRole(role: typeof recruitmentRoles.$inferSelect): AdminRecruitmentRole {
  return {
    id: role.id,
    slug: role.slug,
    title: role.title,
    department: role.department,
    location: role.location,
    employmentType: role.employmentType as EmploymentType,
    shortDescription: role.shortDescription,
    fullDescription: role.fullDescription,
    status: role.status,
    openingDate: role.openingDate,
    closingDate: role.closingDate,
    updatedAt: new Date(role.updatedAt).toISOString(),
  };
}

/** Applicant-safe projection: no database IDs, no internal configuration. */
export function toPublicRole(role: typeof recruitmentRoles.$inferSelect): PublicRecruitmentRole {
  return {
    slug: role.slug,
    title: role.title,
    department: role.department,
    location: role.location,
    employmentType: role.employmentType as EmploymentType,
    shortDescription: role.shortDescription,
    fullDescription: role.fullDescription,
    status: role.status,
    openingDate: role.openingDate,
    closingDate: role.closingDate,
  };
}

// ── Eligibility gate configuration ───────────────────────────────────────────

export async function getRoleEligibilityGates(roleId: string) {
  const db = getDatabase();
  return db.select().from(eligibilityGates).where(eq(eligibilityGates.roleId, roleId)).orderBy(asc(eligibilityGates.displayOrder));
}

export function toAdminGate(gate: typeof eligibilityGates.$inferSelect): AdminEligibilityGate {
  return {
    reference: gate.reference,
    name: gate.name,
    description: gate.description,
    gateType: gate.gateType,
    status: gate.status,
    displayOrder: gate.displayOrder,
    configuration: parseJson<Record<string, unknown>>(gate.configuration, {}),
  };
}

/**
 * Applicant-safe gate configuration: wording and state only. The only
 * structured value exposed is the minimum relevant experience where the
 * applicant UX needs it (G3) — never scoring or decision configuration.
 */
export function toPublicEligibility(roleSlug: string, gates: Array<typeof eligibilityGates.$inferSelect>): PublicEligibilityConfiguration {
  const publicGates: PublicEligibilityGate[] = gates.map((gate) => {
    const configuration = parseJson<Record<string, unknown>>(gate.configuration, {});
    const minimumYears = gate.gateType === "experience" && typeof configuration.minimumYears === "number" ? configuration.minimumYears : undefined;
    return { reference: gate.reference, name: gate.name, description: gate.description, gateType: gate.gateType, status: gate.status, ...(minimumYears !== undefined ? { minimumYears } : {}) };
  });
  return {
    roleSlug,
    gates: publicGates,
    summary: {
      totalCount: publicGates.length,
      activeCount: publicGates.filter((gate) => gate.status === "Active").length,
      configurationRequiredCount: publicGates.filter((gate) => gate.status === "Configuration Required").length,
    },
  };
}

// ── Evaluation Framework configuration ───────────────────────────────────────

export async function getRoleEvaluationFramework(roleId: string): Promise<EvaluationFrameworkConfiguration> {
  const db = getDatabase();
  const [dimensions, screeningRows, verificationRows, bonusRows, bandRows] = await Promise.all([
    db.select().from(assessmentDimensions).where(eq(assessmentDimensions.roleId, roleId)).orderBy(asc(assessmentDimensions.displayOrder)),
    db.select().from(screeningConfigurations).where(eq(screeningConfigurations.roleId, roleId)).limit(1),
    db.select().from(screeningVerificationMultipliers),
    db.select().from(screeningBonusCriteria),
    db.select().from(screeningBands),
  ]);
  const screening = screeningRows[0] ?? null;
  const ownedVerification = screening ? verificationRows.filter((row) => row.screeningConfigurationId === screening.id) : [];
  const ownedBonus = screening ? bonusRows.filter((row) => row.screeningConfigurationId === screening.id) : [];
  const ownedBands = screening ? bandRows.filter((row) => row.screeningConfigurationId === screening.id) : [];
  return {
    roleId,
    dimensions: dimensions.map((dimension) => ({
      reference: dimension.reference,
      name: dimension.name,
      weight: dimension.weight,
      minimumFloor: dimension.minimumFloor,
      displayOrder: dimension.displayOrder,
      status: dimension.status,
    })),
    totalWeight: dimensions.reduce((sum, dimension) => sum + dimension.weight, 0),
    screening: screening
      ? {
          integrityPenalty: screening.integrityPenalty,
          bonusCap: screening.bonusCap,
          verification: ownedVerification
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((row) => ({ code: row.code, label: row.label, multiplier: Number(row.multiplier) })),
          bonusItems: ownedBonus
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((row) => ({ code: row.code, label: row.label, points: row.points })),
          bands: ownedBands
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((row) => ({ band: row.band, minimumScore: Number(row.minimumScore), maximumScore: decimalToNumber(row.maximumScore), label: row.label })),
          manualReviewRules: parseJson<Record<string, unknown>>(screening.manualReviewRules, {}),
        }
      : null,
  };
}
