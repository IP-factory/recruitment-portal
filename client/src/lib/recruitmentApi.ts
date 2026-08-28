/**
 * Task 24C-1 — client recruitment API module.
 *
 * Single fetch layer for the cut-over domains (Recruitment Role, Eligibility
 * configuration, Evaluation Framework). The TiDB database is the source of
 * truth: there is intentionally NO fallback to frontend mock configuration —
 * an API failure surfaces as a visible, restrained error state instead.
 *
 * Admin calls send `credentials: "include"` so the Task 24B HttpOnly
 * `app_session_id` cookie authorizes the request.
 */
import type {
  AdminEligibilityGate,
  AdminRecruitmentRole,
  EvaluationFrameworkConfiguration,
  PublicEligibilityConfiguration,
  PublicRecruitmentRole,
  RecruitmentRoleInput,
} from "@shared/recruitmentApi";
import type {
  AdminQuestionDetail,
  AdminQuestionListResponse,
  QuestionCreateInput,
  QuestionListQuery,
  QuestionUpdateInput,
} from "@shared/questionBankApi";

export type {
  AdminEligibilityGate,
  AdminRecruitmentRole,
  EligibilityGateSummary,
  EmploymentType,
  EvaluationFrameworkConfiguration,
  PublicEligibilityConfiguration,
  PublicEligibilityGate,
  PublicRecruitmentRole,
  RecruitmentRoleInput,
  RoleStatus,
  ScreeningBandEntry,
} from "@shared/recruitmentApi";

export type {
  AdminNumericBand,
  AdminNumericConfig,
  AdminOpenConfig,
  AdminQuestionCrossCheck,
  AdminQuestionDetail,
  AdminQuestionListItem,
  AdminQuestionListResponse,
  AdminQuestionOption,
  AdminRubricAnchor,
  QuestionBankStatus,
  QuestionCreateInput,
  QuestionDimensionEntry,
  QuestionInput,
  QuestionListQuery,
  QuestionListSortKey,
  QuestionType,
  QuestionUpdateInput,
} from "@shared/questionBankApi";

export {
  deriveEligibilityGateSummary,
  describeScreeningBandRange,
  EMPLOYMENT_TYPES,
  formatRoleDateLabel,
  formatRoleUpdatedLabel,
  ROLE_STATUSES,
} from "@shared/recruitmentApi";

export { QUESTION_BANK_STATUSES, QUESTION_TYPES } from "@shared/questionBankApi";

export class RecruitmentApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RecruitmentApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const serverMessage = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : null;
    throw new RecruitmentApiError(response.status, serverMessage ?? "Unable to load recruitment data.");
  }
  return body as T;
}

const jsonBody = (input: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),
});

// ── Public (applicant-facing) ────────────────────────────────────────────────

export async function fetchOpenRoles(): Promise<PublicRecruitmentRole[]> {
  const payload = await request<{ roles: PublicRecruitmentRole[] }>("/api/public/recruitment-roles");
  return payload.roles;
}

export async function fetchPublicRole(slug: string): Promise<PublicRecruitmentRole> {
  const payload = await request<{ role: PublicRecruitmentRole }>(`/api/public/recruitment-roles/${encodeURIComponent(slug)}`);
  return payload.role;
}

export async function fetchPublicEligibility(slug: string): Promise<PublicEligibilityConfiguration> {
  return request<PublicEligibilityConfiguration>(`/api/public/recruitment-roles/${encodeURIComponent(slug)}/eligibility`);
}

// ── Admin (Task 24B session cookie required) ─────────────────────────────────

export async function fetchAdminRoles(): Promise<AdminRecruitmentRole[]> {
  const payload = await request<{ roles: AdminRecruitmentRole[] }>("/api/admin/recruitment-roles");
  return payload.roles;
}

export async function fetchAdminRole(idOrSlug: string): Promise<AdminRecruitmentRole> {
  const payload = await request<{ role: AdminRecruitmentRole }>(`/api/admin/recruitment-roles/${encodeURIComponent(idOrSlug)}`);
  return payload.role;
}

export async function createAdminRole(input: RecruitmentRoleInput): Promise<AdminRecruitmentRole> {
  const payload = await request<{ role: AdminRecruitmentRole }>("/api/admin/recruitment-roles", jsonBody(input));
  return payload.role;
}

export async function updateAdminRole(idOrSlug: string, input: RecruitmentRoleInput): Promise<AdminRecruitmentRole> {
  const payload = await request<{ role: AdminRecruitmentRole }>(`/api/admin/recruitment-roles/${encodeURIComponent(idOrSlug)}`, {
    ...jsonBody(input),
    method: "PATCH",
  });
  return payload.role;
}

export async function fetchAdminEligibility(idOrSlug: string): Promise<{ roleId: string; gates: AdminEligibilityGate[] }> {
  return request<{ roleId: string; gates: AdminEligibilityGate[] }>(`/api/admin/recruitment-roles/${encodeURIComponent(idOrSlug)}/eligibility`);
}

export async function fetchEvaluationFramework(idOrSlug: string): Promise<EvaluationFrameworkConfiguration> {
  return request<EvaluationFrameworkConfiguration>(`/api/admin/recruitment-roles/${encodeURIComponent(idOrSlug)}/evaluation-framework`);
}

// ── Admin Question Bank (Task 24C-2) ─────────────────────────────────────────

export async function fetchQuestions(query: QuestionListQuery = {}): Promise<AdminQuestionListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.dimension) params.set("dimension", query.dimension);
  if (query.type) params.set("type", query.type);
  if (query.status) params.set("status", query.status);
  if (query.sortKey) params.set("sortKey", query.sortKey);
  if (query.sortDirection) params.set("sortDirection", query.sortDirection);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request<AdminQuestionListResponse>(`/api/admin/questions${suffix}`);
}

export async function fetchQuestion(idOrReference: string): Promise<AdminQuestionDetail> {
  const payload = await request<{ question: AdminQuestionDetail }>(`/api/admin/questions/${encodeURIComponent(idOrReference)}`);
  return payload.question;
}

export async function createQuestion(input: QuestionCreateInput): Promise<AdminQuestionDetail> {
  const payload = await request<{ question: AdminQuestionDetail }>("/api/admin/questions", jsonBody(input));
  return payload.question;
}

export async function updateQuestion(idOrReference: string, input: QuestionUpdateInput): Promise<AdminQuestionDetail> {
  const payload = await request<{ question: AdminQuestionDetail }>(`/api/admin/questions/${encodeURIComponent(idOrReference)}`, {
    ...jsonBody(input),
    method: "PATCH",
  });
  return payload.question;
}
