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
  EligibilityGateInput,
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
  EligibilityGateConfiguration,
  EligibilityGateInput,
  EligibilityGateOption,
  EligibilityGateSummary,
  EmploymentType,
  EvaluationFrameworkConfiguration,
  GateInputType,
  GateStatus,
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
  describeEligibilityGateSummary,
  describeScreeningBandRange,
  EMPLOYMENT_TYPES,
  formatRoleDateLabel,
  formatRoleUpdatedLabel,
  GATE_INPUT_TYPES,
  GATE_STATUSES,
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

export async function createAdminEligibilityGate(idOrSlug: string, input: EligibilityGateInput): Promise<AdminEligibilityGate> {
  const payload = await request<{ gate: AdminEligibilityGate }>(`/api/admin/recruitment-roles/${encodeURIComponent(idOrSlug)}/eligibility`, jsonBody(input));
  return payload.gate;
}

export async function updateAdminEligibilityGate(gateId: string, input: EligibilityGateInput): Promise<AdminEligibilityGate> {
  const payload = await request<{ gate: AdminEligibilityGate }>(`/api/admin/eligibility-gates/${encodeURIComponent(gateId)}`, {
    ...jsonBody(input),
    method: "PUT",
  });
  return payload.gate;
}

export async function deleteAdminEligibilityGate(gateId: string): Promise<void> {
  await request<{ ok: boolean }>(`/api/admin/eligibility-gates/${encodeURIComponent(gateId)}`, { method: "DELETE" });
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

// ── Admin Assessments (Task 24C-3) ────────────────────────────────────────────

import type {
  AdminAssessmentDetail,
  AdminAssessmentListItem,
  AdminAssessmentListResponse,
  AdminAssessmentPreviewPayload,
  AssessmentCreateInput,
  AssessmentRoleSummary,
  AssessmentStatus,
  AssessmentUpdateInput,
  AssignedQuestionFull,
  AssignedQuestionSummary,
} from "@shared/assessmentApi";

export type {
  AdminAssessmentDetail,
  AdminAssessmentListItem,
  AdminAssessmentListResponse,
  AdminAssessmentPreviewPayload,
  AssessmentCreateInput,
  AssessmentRoleSummary,
  AssessmentStatus,
  AssessmentUpdateInput,
  AssignedQuestionFull,
  AssignedQuestionSummary,
} from "@shared/assessmentApi";

export { ASSESSMENT_STATUSES } from "@shared/assessmentApi";

export async function fetchAssessments(): Promise<AdminAssessmentListResponse> {
  return request<AdminAssessmentListResponse>("/api/admin/assessments");
}

export async function fetchAssessment(idOrSlug: string): Promise<AdminAssessmentDetail> {
  const payload = await request<{ assessment: AdminAssessmentDetail }>(
    `/api/admin/assessments/${encodeURIComponent(idOrSlug)}`,
  );
  return payload.assessment;
}

export async function createAssessment(input: AssessmentCreateInput): Promise<AdminAssessmentDetail> {
  const payload = await request<{ assessment: AdminAssessmentDetail }>(
    "/api/admin/assessments",
    jsonBody(input),
  );
  return payload.assessment;
}

export async function updateAssessment(
  idOrSlug: string,
  input: AssessmentUpdateInput,
): Promise<AdminAssessmentDetail> {
  const payload = await request<{ assessment: AdminAssessmentDetail }>(
    `/api/admin/assessments/${encodeURIComponent(idOrSlug)}`,
    { ...jsonBody(input), method: "PATCH" },
  );
  return payload.assessment;
}

export async function fetchAssessmentPreview(idOrSlug: string): Promise<AdminAssessmentPreviewPayload> {
  const payload = await request<{ preview: AdminAssessmentPreviewPayload }>(
    `/api/admin/assessments/${encodeURIComponent(idOrSlug)}/preview`,
  );
  return payload.preview;
}

export async function addAssessmentQuestion(
  idOrSlug: string,
  questionId: string,
): Promise<AssignedQuestionSummary[]> {
  const payload = await request<{ assignments: AssignedQuestionSummary[] }>(
    `/api/admin/assessments/${encodeURIComponent(idOrSlug)}/questions`,
    jsonBody({ questionId }),
  );
  return payload.assignments;
}

export async function removeAssessmentQuestion(
  idOrSlug: string,
  questionId: string,
): Promise<AssignedQuestionSummary[]> {
  const payload = await request<{ assignments: AssignedQuestionSummary[] }>(
    `/api/admin/assessments/${encodeURIComponent(idOrSlug)}/questions/${encodeURIComponent(questionId)}`,
    { method: "DELETE" },
  );
  return payload.assignments;
}

export async function reorderAssessmentQuestions(
  idOrSlug: string,
  orderedQuestionIds: string[],
): Promise<AssignedQuestionSummary[]> {
  const payload = await request<{ assignments: AssignedQuestionSummary[] }>(
    `/api/admin/assessments/${encodeURIComponent(idOrSlug)}/questions/order`,
    { ...jsonBody({ orderedQuestionIds }), method: "PUT" },
  );
  return payload.assignments;
}
