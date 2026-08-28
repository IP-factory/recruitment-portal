# Task 24C-3 — Assessment Builder, Detail and Admin Preview Cutover Notes

## Summary

The Admin Assessment configuration domain is now fully database-backed. TiDB
is the authoritative source for assessment list, detail, builder assignments,
question ordering, and admin preview composition.

---

## Database-backed now

| Domain | Source |
|---|---|
| Assessment list (`/admin/assessments`) | `assessments` table via `/api/admin/assessments` |
| Assessment detail (`/admin/assessments/:slug`) | `assessments` + `assessment_question_assignments` + `assessment_questions` via `/api/admin/assessments/:slug` |
| Assessment metadata (name, description, version, status, role) | TiDB `assessments` table |
| Builder assigned question list | `assessment_question_assignments` ordered by `display_order` |
| Builder available question list | Question Bank API (`/api/admin/questions`) — Active questions only |
| Assignment order | `assessment_question_assignments.display_order` (persisted via `PUT /api/admin/assessments/:slug/questions/order`) |
| Add question | `POST /api/admin/assessments/:slug/questions` → inserts assignment row |
| Remove question | `DELETE /api/admin/assessments/:slug/questions/:questionId` → removes assignment row, re-normalises order |
| Admin Preview composition | `/api/admin/assessments/:slug/preview` → full `AdminQuestionDetail` for all assigned questions |
| Preview question options (ORDINAL, MULTI, GATE, SJT, EVIDENCE) | `question_options` table — all questions, not just the first |
| Preview numeric configuration | `numeric_question_configs` + `numeric_scoring_bands` |
| Preview open configuration + rubric | `open_question_configs` + `open_rubric_anchors` |
| Preview evidence link | `question_evidence_links` |

---

## firstQuestionOptions limitation — retired

`server/db.ts` previously contained `getAssessmentConfiguration()` which loaded
options only for `assignments[0].question.id` (`firstQuestionOptions`). This was
a known Task 24A limitation.

**Replacement:** `getAssessmentPreviewConfiguration()` in
`server/assessmentRepository.ts` calls `getQuestionDetail()` (from the Question
Bank repository) for every assigned question in a single parallel pass. All 14
assigned questions receive full type configuration. `firstQuestionOptions` no
longer exists anywhere in the codebase.

The old function stub in `server/db.ts` is marked `@deprecated` and delegates
to the new repository. It will be removed when confirmed no callers remain.

---

## Server architecture

```
React
  → /api/admin/assessments (+ sub-routes)
  → server/assessmentApi.ts          (Express router — Task 24C-3)
  → server/assessmentRepository.ts   (repository layer — Task 24C-3)
  → server/questionBankRepository.ts (reused for getQuestionDetail)
  → server/db.ts → Drizzle → TiDB
```

All endpoints use the `requireAuthorizedAdmin` guard from `server/recruitmentApi.ts`
(valid session + Active Admin profile + Admin role).

---

## New server files

| File | Purpose |
|---|---|
| `shared/assessmentApi.ts` | Shared DTO types and validation for the assessment domain |
| `server/assessmentRepository.ts` | TiDB access: list, detail, preview, create, update, add/remove/reorder assignments |
| `server/assessmentApi.ts` | Express router mounting all assessment endpoints |
| `server/task24c3.assessmentApi.test.ts` | Live-database test suite (skipped without `DATABASE_URL`) |

---

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/assessments` | List all assessments with summary |
| `POST` | `/api/admin/assessments` | Create a new assessment (default: Draft) |
| `GET` | `/api/admin/assessments/:idOrSlug` | Full detail with ordered assignment list |
| `PATCH` | `/api/admin/assessments/:idOrSlug` | Update name and description only |
| `GET` | `/api/admin/assessments/:idOrSlug/preview` | Full preview payload — all assigned questions with complete type config |
| `POST` | `/api/admin/assessments/:idOrSlug/questions` | Add a question assignment |
| `DELETE` | `/api/admin/assessments/:idOrSlug/questions/:questionId` | Remove a question assignment |
| `PUT` | `/api/admin/assessments/:idOrSlug/questions/order` | Reorder all assignments atomically |

---

## Modified client files

| File | Change |
|---|---|
| `shared/assessmentApi.ts` | **New** — DTO types and input validation |
| `client/src/lib/recruitmentApi.ts` | Added `fetchAssessments`, `fetchAssessment`, `createAssessment`, `updateAssessment`, `fetchAssessmentPreview`, `addAssessmentQuestion`, `removeAssessmentQuestion`, `reorderAssessmentQuestions` |
| `client/src/hooks/useRecruitmentData.ts` | Added `useAdminAssessments`, `useAdminAssessment`, `useAdminAssessmentPreview` |
| `client/src/pages/AdminAssessments.tsx` | **Cut over** — reads from API, summary cards from server, no localStorage |
| `client/src/pages/AdminAssessmentDetail.tsx` | **Cut over** — reads from API, controlled loading/error/not-found states |
| `client/src/pages/AdminAssessmentBuilder.tsx` | **Cut over** — assigned list from API, available questions from Question Bank API, add/remove persist immediately, reorder persists on Save |
| `client/src/pages/AdminAssessmentPreview.tsx` | **Cut over** — composition from `/preview` endpoint; `toPreviewQuestion()` adapter maps `AdminQuestionDetail` → `QuestionBankQuestion` for the existing renderer |
| `client/src/lib/adminAssessmentData.ts` | LEGACY header added; no longer imported by any Admin assessment page |
| `server/db.ts` | `getAssessmentConfiguration()` replaced with a `@deprecated` stub that delegates to `assessmentRepository` |

---

## Preview shape adapter boundary

`AdminAssessmentPreview.tsx` contains a local `toPreviewQuestion()` function that
maps TiDB `AdminQuestionDetail` objects into the `QuestionBankQuestion` shape
expected by the existing preview renderer and scoring engine.

This adapter:
- Sources **all content from the TiDB API response** — no local fallback
- Exists **only in AdminAssessmentPreview.tsx** — not reused elsewhere
- Will be removed when the renderer is updated to consume `AdminQuestionDetail` directly

---

## Still local / unmigrated (intentional)

These domains are deliberately not migrated in Task 24C-3:

| Domain | Current source | Planned migration |
|---|---|---|
| **Applicant assessment runtime** | `assessmentData.ts` → `adminAssessmentData.ts` (legacy BDM) | Task 24D-2 |
| **Applicant assessment responses** | `localStorage` | Task 24D-2 |
| **Legacy five-question BDM assessment** | `assessmentData.ts` + `questionBankData.ts` | Task 24D-2 |
| **Candidate applications** | `applicationData.ts` (mock) | Future task |
| **CVs** | `candidateCvEvidenceData.ts` (mock) | Future task |
| **Scoring persistence** | Not persisted | Future task |
| **Screening persistence** | `screeningData.ts` (mock) | Future task |
| **Shortlisting** | Not implemented | Future task |
| **OPEN candidate rubric reviews** | Not persisted | Future task |
| **v2 Scoring Preview (ScoringPreview panel)** | `v2BaseScoring.ts` + `v2ModifierScoring.ts` consuming `QuestionBankQuestion` via adapter | Unmigrated; scoring engine not in scope for 24C-3 |

---

## Remaining runtime dependencies on local compatibility files

These files still have legitimate runtime uses **outside** the Admin Assessment
configuration domain. They must not be deleted.

### `client/src/lib/adminAssessmentData.ts`
**Runtime consumers after Task 24C-3:**
- `client/src/lib/assessmentData.ts` — `getBusinessDevelopmentAssessment()` for legacy applicant BDM flow
- `client/src/lib/assessmentScoring.ts` — `getBusinessDevelopmentAssessment()`, `getAssessmentQuestions()` for Admin candidate placeholder scoring
- `client/src/pages/AdminCandidatePlaceholder.tsx` — legacy Admin scoring view
- `client/src/lib/v2BaseScoring.test.ts` (test only) — `getBusinessDevelopmentAssessment()`
- `client/src/lib/questionBankData.test.ts` (test only) — `getAdminAssessment()`, `BUSINESS_DEVELOPMENT_OFFICER_V2_ASSESSMENT_SLUG`

### `client/src/lib/questionBankData.ts`
**Runtime consumers after Task 24C-3:**
- `client/src/lib/assessmentData.ts` — `getQuestionBankQuestions()` for legacy applicant flow
- `client/src/lib/assessmentScoring.ts` — `getQuestionScoreConfiguration()`, `hasQuestionScoring()` for legacy scoring
- `client/src/pages/AdminCandidatePlaceholder.tsx` — `getQuestionScoreConfiguration()`
- `client/src/pages/AdminAssessmentPreview.tsx` — type imports only (`AdminQuestionOption`, `QuestionBankQuestion`) used by the adapter and renderer
- `client/src/lib/v2BaseScoring.ts` — type imports
- `client/src/lib/v2ModifierScoring.ts` — type imports

### `client/src/lib/frameworkQuestionData.ts`
**Runtime consumers after Task 24C-3:**
- `client/src/lib/questionBankData.ts` — `FRAMEWORK_QUESTIONS` merged into the legacy question bank for v2 scoring preview
- `client/src/lib/v2BaseScoring.test.ts` (test only)
- `client/src/lib/v2ModifierScoring.test.ts` (test only)
- `client/src/lib/adminAssessmentData.ts` — `FRAMEWORK_DRAFT_ORDER` used in legacy default assessment fixture

### `client/src/lib/assessmentPreviewData.ts`
**Runtime consumers after Task 24C-3:**
- `client/src/pages/AdminAssessmentPreview.tsx` — storage utilities, preview state types (legitimate, these are pure utilities with no question content)
- `client/src/lib/assessmentPreviewData.test.ts` (test only)

No runtime consumer of `assessmentPreviewData.ts` returns local question content.

---

## Activation guard

`Business Development Officer Assessment v2` remains **Draft / Inactive**.

The `PATCH /api/admin/assessments/:slug` endpoint updates name and description
only. It does not accept `status` changes. No activation path is exposed in
this phase.

The Assessment Builder UI displays an informational note:
> **Assessment status: Draft.** Activation will be enabled when the assessment
> is ready for applicant use.

---

## Duplicate assignment protection

The `assessment_question_assignments` table enforces a unique index on
`(assessmentId, questionId)`. The repository additionally checks for duplicates
before attempting an insert and returns a clean `400` with:
> *This question is already assigned to the assessment.*

---

## Inactive question protection

`addAssessmentQuestion()` validates `question.status === "Active"` before
inserting. Inactive questions return:
> *Only Active questions can be assigned to an assessment.*

Already-assigned questions that later become Inactive remain in the assignment
list. The builder renders them with an "Inactive — warning" badge.

---

## Reorder transaction safety

`reorderAssessmentQuestions()` uses a two-phase approach to avoid hitting the
`(assessmentId, displayOrder)` unique index during intermediate states:

1. Write a temporary offset (`10000 + i`) for all rows
2. Write the final `1…N` values

Both phases run inside a single Drizzle transaction.

---

## Test coverage (Task 24C-3)

`server/task24c3.assessmentApi.test.ts` — skipped without `DATABASE_URL`:

| Test | Description |
|---|---|
| TEST-49 | Seeded BDO v2 has correct name, version 2, status Draft, 14 questions |
| TEST-50 | Assignment order exactly matches the 14-question approved sequence |
| TEST-51 | Auth: anonymous and viewer rejected; active Admin succeeds |
| TEST-52 | Add question increases count, produces correct `displayOrder` |
| TEST-53 | Duplicate assignment returns controlled 400 |
| TEST-54 | Reorder persists to database and survives a fresh read |
| TEST-55 | Remove assignment deletes only the assignment, question remains in Question Bank |
| TEST-56 | Inactive question cannot be newly assigned |
| TEST-57 | Preview returns all 14 questions with complete type config; D2.Q2 (14th) has full numericConfig — retires `firstQuestionOptions` |
| TEST-66 | BDO v2 is unchanged after all tests (Draft, 14 questions, approved order) |
