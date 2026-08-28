/**
 * Task 24C-1 — async data hooks for the database-backed recruitment domains.
 *
 * Every hook resolves from the API only; on failure it reports the error so
 * the page can show a restrained error state instead of falling back to any
 * local mock configuration.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAdminEligibility,
  fetchAdminRole,
  fetchAdminRoles,
  fetchAssessment,
  fetchAssessmentPreview,
  fetchAssessments,
  fetchEvaluationFramework,
  fetchOpenRoles,
  fetchPublicEligibility,
  fetchQuestion,
  fetchQuestions,
  type AdminAssessmentDetail,
  type AdminAssessmentListResponse,
  type AdminAssessmentPreviewPayload,
  type AdminEligibilityGate,
  type AdminQuestionDetail,
  type AdminQuestionListResponse,
  type AdminRecruitmentRole,
  type EvaluationFrameworkConfiguration,
  type PublicEligibilityConfiguration,
  type PublicRecruitmentRole,
  type QuestionListQuery,
} from "@/lib/recruitmentApi";

export type AsyncDataStatus = "loading" | "ready" | "error";

export interface AsyncDataState<T> {
  status: AsyncDataStatus;
  data: T | null;
  error: string | null;
  reload: () => void;
}

export function useAsyncData<T>(load: () => Promise<T>, deps: ReadonlyArray<unknown> = []): AsyncDataState<T> {
  const [status, setStatus] = useState<AsyncDataStatus>("loading");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    loadRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus("ready");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(reason instanceof Error ? reason.message : "Unable to load recruitment data.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { status, data, error, reload };
}

// ── Convenience hooks ────────────────────────────────────────────────────────

export function usePublicRoles() {
  return useAsyncData<PublicRecruitmentRole[]>(() => fetchOpenRoles());
}

export function usePublicEligibility(slug: string) {
  return useAsyncData<PublicEligibilityConfiguration>(() => fetchPublicEligibility(slug), [slug]);
}

export function useAdminRoles() {
  return useAsyncData<AdminRecruitmentRole[]>(() => fetchAdminRoles());
}

export function useAdminRole(idOrSlug: string | undefined) {
  return useAsyncData<AdminRecruitmentRole | null>(async () => (idOrSlug ? fetchAdminRole(idOrSlug) : null), [idOrSlug]);
}

export function useAdminEligibility(idOrSlug: string | undefined) {
  return useAsyncData<{ roleId: string; gates: AdminEligibilityGate[] } | null>(async () => (idOrSlug ? fetchAdminEligibility(idOrSlug) : null), [idOrSlug]);
}

export function useEvaluationFramework(idOrSlug: string | undefined) {
  return useAsyncData<EvaluationFrameworkConfiguration | null>(async () => (idOrSlug ? fetchEvaluationFramework(idOrSlug) : null), [idOrSlug]);
}

// ── Question Bank (Task 24C-2) ───────────────────────────────────────────────

export function useQuestionBank(query: QuestionListQuery) {
  const { search, dimension, type, status, sortKey, sortDirection, page, pageSize } = query;
  return useAsyncData<AdminQuestionListResponse>(
    () => fetchQuestions({ search, dimension, type, status, sortKey, sortDirection, page, pageSize }),
    [search, dimension, type, status, sortKey, sortDirection, page, pageSize],
  );
}

export function useQuestionDetail(idOrReference: string | undefined) {
  return useAsyncData<AdminQuestionDetail | null>(async () => {
    if (!idOrReference) return null;
    try {
      return await fetchQuestion(idOrReference);
    } catch (error) {
      // A missing question is a legitimate state for the detail page; network
      // and server failures still surface as errors.
      if (error instanceof Error && (error as Error & { status?: number }).status === 404) return null;
      throw error;
    }
  }, [idOrReference]);
}

// ── Admin Assessments (Task 24C-3) ────────────────────────────────────────────

export function useAdminAssessments() {
  return useAsyncData<AdminAssessmentListResponse>(() => fetchAssessments());
}

export function useAdminAssessment(idOrSlug: string | undefined) {
  return useAsyncData<AdminAssessmentDetail | null>(
    async () => {
      if (!idOrSlug) return null;
      try {
        return await fetchAssessment(idOrSlug);
      } catch (error) {
        if (error instanceof Error && (error as Error & { status?: number }).status === 404) return null;
        throw error;
      }
    },
    [idOrSlug],
  );
}

export function useAdminAssessmentPreview(idOrSlug: string | undefined) {
  return useAsyncData<AdminAssessmentPreviewPayload | null>(
    async () => {
      if (!idOrSlug) return null;
      try {
        return await fetchAssessmentPreview(idOrSlug);
      } catch (error) {
        if (error instanceof Error && (error as Error & { status?: number }).status === 404) return null;
        throw error;
      }
    },
    [idOrSlug],
  );
}
