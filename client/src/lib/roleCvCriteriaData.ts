/** Quiet Authority CV criteria data: role-specific browser-local configuration only; no candidate CV evidence or scoring. */
import { BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID } from "@/lib/recruitmentRoleReferences";

export type CvCriterionStatus = "Active" | "Inactive";
export type CvEvidenceCriterion = { id: string; name: string; description: string; weight: number; order: number; status: CvCriterionStatus };
type RoleCriteriaStore = Record<string, CvEvidenceCriterion[]>;

export const CV_CRITERIA_STORAGE_KEY = "recruitment-portal:admin-demo-role-cv-criteria";
export const BUSINESS_DEVELOPMENT_CV_CRITERIA_ROLE_ID = BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID;

const defaultCriteria: CvEvidenceCriterion[] = [
  { id: "cv-criterion-bd-experience", name: "Relevant Business Development Experience", description: "Evidence of directly relevant Business Development responsibilities and experience.", weight: 30, order: 1, status: "Active" },
  { id: "cv-criterion-prospecting", name: "Prospecting & New Client Acquisition", description: "Evidence of identifying prospects, generating leads or acquiring new clients.", weight: 15, order: 2, status: "Active" },
  { id: "cv-criterion-target-revenue", name: "Target & Revenue Ownership", description: "Evidence of responsibility for sales targets, revenue goals, pipeline value or commercial performance.", weight: 15, order: 3, status: "Active" },
  { id: "cv-criterion-account-management", name: "Client & Account Management", description: "Evidence of managing client relationships, accounts or ongoing commercial engagements.", weight: 10, order: 4, status: "Active" },
  { id: "cv-criterion-negotiation", name: "Negotiation & Closing", description: "Evidence of participating in negotiations, converting opportunities or closing commercial deals.", weight: 10, order: 5, status: "Active" },
  { id: "cv-criterion-leadership", name: "Leadership & Team Responsibility", description: "Evidence of managing, supervising or coordinating people in a commercial or Business Development environment.", weight: 10, order: 6, status: "Active" },
  { id: "cv-criterion-crm", name: "CRM, Sales Process & Reporting", description: "Evidence of structured pipeline management, CRM use, sales reporting or commercial process discipline.", weight: 5, order: 7, status: "Active" },
  { id: "cv-criterion-achievements", name: "Relevant Commercial Achievements", description: "Evidence of measurable Business Development, sales or commercial achievements.", weight: 5, order: 8, status: "Active" },
];

const cloneCriteria = (criteria: CvEvidenceCriterion[]) => criteria.map((criterion) => ({ ...criterion }));
const sortAndOrder = (criteria: CvEvidenceCriterion[]) => criteria.map((criterion, index) => ({ ...criterion, order: index + 1 }));
function readStore(): RoleCriteriaStore | null { if (typeof window === "undefined") return null; try { const stored = window.localStorage.getItem(CV_CRITERIA_STORAGE_KEY); const parsed = stored ? JSON.parse(stored) : null; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as RoleCriteriaStore : null; } catch { return null; } }
function saveStore(store: RoleCriteriaStore) { if (typeof window !== "undefined") window.localStorage.setItem(CV_CRITERIA_STORAGE_KEY, JSON.stringify(store)); return store; }

export function getRoleCvCriteria(roleId: string): CvEvidenceCriterion[] {
  const saved = readStore()?.[roleId];
  if (Array.isArray(saved)) return sortAndOrder(cloneCriteria(saved).sort((first, second) => first.order - second.order));
  return roleId === BUSINESS_DEVELOPMENT_CV_CRITERIA_ROLE_ID ? cloneCriteria(defaultCriteria) : [];
}

export function getRoleCvCriteriaSummary(roleId: string) {
  const criteria = getRoleCvCriteria(roleId);
  const activeCriteria = criteria.filter((criterion) => criterion.status === "Active");
  const totalWeight = activeCriteria.reduce((total, criterion) => total + criterion.weight, 0);
  return { criteria, activeCount: activeCriteria.length, totalWeight, ready: activeCriteria.length > 0 && totalWeight === 100 };
}

export function saveRoleCvCriteria(roleId: string, criteria: CvEvidenceCriterion[]) {
  const current = readStore() ?? {};
  const ordered = sortAndOrder(cloneCriteria(criteria));
  saveStore({ ...current, [roleId]: ordered });
  return ordered;
}

export function createCvCriterionId() { return `cv-criterion-${Date.now()}`; }
