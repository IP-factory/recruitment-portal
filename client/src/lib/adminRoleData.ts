/**
 * Quiet Authority Recruitment Roles data: a single frontend-only, browser-local source for role management and approved public opportunity availability.
 */
export type RoleStatus = "Draft" | "Open" | "Closed" | "Archived";
export type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Internship" | "Temporary";
export type RecruitmentRole = {
  id: string;
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
  applicationCount: number;
  submittedCount: number;
  inProgressCount: number;
  lastUpdated: string;
  lastUpdatedLabel: string;
};

export type RecruitmentRoleInput = Omit<RecruitmentRole, "id" | "slug" | "applicationCount" | "submittedCount" | "inProgressCount" | "lastUpdated" | "lastUpdatedLabel">;
export const RECRUITMENT_ROLES_STORAGE_KEY = "recruitment-portal:admin-demo-roles";
export const BUSINESS_DEVELOPMENT_OFFICER_ROLE_ID = "role-business-development-officer";
/** Legacy alias retained so existing Admin data contracts remain stable while the visible role title migrates. */
export const BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID = BUSINESS_DEVELOPMENT_OFFICER_ROLE_ID;

const defaultRoles: RecruitmentRole[] = [{
  id: BUSINESS_DEVELOPMENT_OFFICER_ROLE_ID,
  slug: "business-development-officer",
  title: "Business Development Officer",
  department: "Business Development",
  location: "To be confirmed",
  employmentType: "Full-time",
  shortDescription: "We are looking for a commercially minded Business Development Officer who can identify opportunities, build strong client relationships and contribute to sustainable business growth.",
  fullDescription: "",
  status: "Open",
  openingDate: null,
  closingDate: null,
  applicationCount: 24,
  submittedCount: 18,
  inProgressCount: 6,
  lastUpdated: "2026-08-26",
  lastUpdatedLabel: "26 Aug 2026",
}];

function slugify(title: string) { return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "recruitment-role"; }
function labelForDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const dateValue = new Date(Date.UTC(year, month - 1, day));
  return dateValue.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
function saveRoles(roles: RecruitmentRole[]) { if (typeof window !== "undefined") window.localStorage.setItem(RECRUITMENT_ROLES_STORAGE_KEY, JSON.stringify(roles)); return roles; }

function normalizeRole(role: RecruitmentRole): RecruitmentRole {
  if (role.id !== "role-business-development-manager" && role.slug !== "business-development-manager" && role.title !== "Business Development Manager") return role;
  const replaceManager = (value: string) => value.replaceAll("Business Development Manager", "Business Development Officer");
  return { ...role, id: BUSINESS_DEVELOPMENT_OFFICER_ROLE_ID, slug: "business-development-officer", title: "Business Development Officer", shortDescription: replaceManager(role.shortDescription), fullDescription: replaceManager(role.fullDescription) };
}

export function getRecruitmentRoles(): RecruitmentRole[] {
  if (typeof window === "undefined") return defaultRoles;
  try { const stored = window.localStorage.getItem(RECRUITMENT_ROLES_STORAGE_KEY); const parsed = stored ? JSON.parse(stored) : null; return Array.isArray(parsed) && parsed.length ? (parsed as RecruitmentRole[]).map(normalizeRole) : defaultRoles; } catch { return defaultRoles; }
}

export function getRecruitmentRole(slug: string) { const normalizedSlug = slug === "business-development-manager" ? "business-development-officer" : slug; return getRecruitmentRoles().find((role) => role.slug === normalizedSlug); }
export function getBusinessDevelopmentOfficerRole() { return getRecruitmentRoles().find((role) => role.id === BUSINESS_DEVELOPMENT_OFFICER_ROLE_ID) ?? defaultRoles[0]; }
/** @deprecated Use getBusinessDevelopmentOfficerRole for visible role copy. */
export function getBusinessDevelopmentManagerRole() { return getBusinessDevelopmentOfficerRole(); }
export function createRecruitmentRole(input: RecruitmentRoleInput): RecruitmentRole {
  const now = new Date();
  const uniqueSlug = `${slugify(input.title)}-${now.getTime()}`;
  const role: RecruitmentRole = { ...input, id: `role-${uniqueSlug}`, slug: uniqueSlug, applicationCount: 0, submittedCount: 0, inProgressCount: 0, lastUpdated: now.toISOString().slice(0, 10), lastUpdatedLabel: labelForDate(now.toISOString().slice(0, 10)) };
  saveRoles([...getRecruitmentRoles(), role]);
  return role;
}

export function updateRecruitmentRole(id: string, input: RecruitmentRoleInput): RecruitmentRole | undefined {
  let updated: RecruitmentRole | undefined;
  const roles = getRecruitmentRoles().map((role) => { if (role.id !== id) return role; updated = { ...role, ...input, lastUpdated: "2026-08-26", lastUpdatedLabel: "26 Aug 2026" }; return updated; });
  saveRoles(roles);
  return updated;
}

export function formatRoleDate(value: string | null) { return value ? labelForDate(value) : "Not set"; }
