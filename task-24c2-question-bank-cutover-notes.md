# Task 24C-2 — Cut Over Question Bank to the Database

**Date:** 2026-08-28
**Scope:** Admin Question Bank only — Question Bank list, Question detail, Create Question, Edit Question, and all type-specific configuration. TiDB becomes the runtime source of truth for the Question Bank; the frontend mocks are retired as Question Bank runtime sources. Task 24C-1 (Role/Eligibility/Evaluation Framework) is untouched and regression-verified.

## Architecture

`React client → /api → Express → questionBankRepository → Drizzle → TiDB`

- Same layering as Task 24C-1: all database access is server-side, no SQL inside route handlers, all writes run in transactions, and `client/src` contains no database imports.
- Shared contract module: `shared/questionBankApi.ts` — the 7 formal types (`GATE`, `ORDINAL`, `MULTI`, `NUMERIC`, `SJT`, `OPEN`, `EVIDENCE`; no legacy Experience/Scenario), DTO types, server-authoritative **type-aware** validation (`validateQuestionInput`), scoring bounds (ORDINAL 4–5 options · raw 0–5; MULTI decoys forced −1 with default cap 5; SJT exactly 4 options with scores in −2…5 and mandatory internal explanations; NUMERIC non-overlapping bands; OPEN rubric anchors `scoreMin ≤ scoreMax`; EVIDENCE multipliers restricted to 1.00/0.95/0.85 and no self-verification), and cross-check rule types (`Integrity flag`, `Manual review`).
- Server layers: `server/questionBankRepository.ts` (transactional list/detail/create/update) and `server/questionBankApi.ts` (Express router), mounted in `server/index.ts`.
- Client layers: Question Bank functions added to `client/src/lib/recruitmentApi.ts` + `useQuestionBank` / `useQuestionDetail` hooks in `client/src/hooks/useRecruitmentData.ts`. `useQuestionDetail` maps a 404 to `null` so the detail page can render a restrained not-found panel.
- Authorization reuses Task 24B unchanged (`requireAuthorizedAdmin` = valid session + Active Admin profile + Admin role). There are **no public Question Bank endpoints**. Unauthorized → `401 { ok:false, error:"Admin authorization is required." }`.

## Endpoints (all Admin-only)

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/admin/questions` | Paginated list (default `pageSize` 10, max 50) returning `items/total/page/pageSize/totalPages` plus DB-resolved `dimensions` (D1–D8, no second hard-coded copy) and `summary`. Filters: `search`, `dimension` (`GATE` matches questions without a dimension), `type`, `status`; sorting by `reference`/`updatedAt` asc/desc. List rows are concise — no nested option/band/rubric payloads. `usedIn` labels append the assessment status unless Active (`formatUsedInLabel`). |
| POST | `/api/admin/questions` | Type-aware validation; duplicate reference → 400 `A question with reference "X" already exists.`; `qWeight ∈ {1,2,3}` for scored types and null for GATE/EVIDENCE; max raw score 5; 201 `{ ok:true, question }`. Nested configuration is written in one transaction. |
| GET | `/api/admin/questions/:idOrReference` | Full common + type-specific projection: ORDINAL close-application option resolved to its gate (D1.Q1 option D → close → G3, raw score null); MULTI −1 decoys + score cap; NUMERIC mode/derived calculation/input definitions/ordered bands; SJT 4 options with internal explanations; OPEN word limits/time limit/paste policy + rubric ranges; EVIDENCE paired question (D2.Q1E ↔ D2.Q1) + multipliers; **cross-checks returned from both sides** (`source`/`comparison`). Unknown id → restrained 404 `Unable to load this question.` |
| PATCH | `/api/admin/questions/:idOrReference` | Reference locked after creation (`Question references cannot be changed after creation.`); type change rejected while the question is used in an assessment; nested configuration replaced transactionally so no stale options/bands/rubric/cross-checks survive. |

Errors always use the restrained JSON shape `{ ok:false, error }`; unexpected failures → 503 `Unable to load recruitment data.` with server-side-only logging. Validation failures → 400 with the specific message(s).

## Client cutover (approved UI preserved — no redesign)

- **Question Bank list** (`AdminQuestionBank.tsx`): `useQuestionBank` with search/type/dimension/status filters, sortable columns, pagination (10 per page), summary counts, and DB-resolved dimension filter options. Loading/error states via the shared async-state components; no blank flash that could be mistaken for data.
- **Question detail** (`AdminQuestionDetail.tsx`): `useQuestionDetail`; renders type-specific sections per the projections above plus cross-check cards ("Integrity cross-check with D1.Q2 …", "Manual review with D4.Q2 …") and the used-in assessment label. 404 → restrained not-found panel with a Back-to-Bank action.
- **Question form** (`AdminQuestionForm.tsx`): create + edit against the API. Edit safety: the editor component only mounts after the detail resolves and remounts via `key`, so blank defaults can never render over (or be saved onto) real data. Reference field disabled on edit; dimension select built from the DB dimensions + a Gate sentinel; paired-question dropdown sourced from the fetched bank. Restrained inline server-error display; Save disabled while saving.
- Schema-driven UI trims (no invented fields): the legacy `flagIf` field was removed (no DB column), numeric input definitions carry label + unit only, and NUMERIC mode offers exactly the two database modes (two-value derived, calendar-year experience). OPEN rubric anchors are authored as exact scores (`scoreMin = scoreMax`); the detail page still renders ranges.

## Mock retirement

- `client/src/lib/questionBankData.ts` and `client/src/lib/frameworkQuestionData.ts` are no longer runtime sources for the Question Bank pages — all three Question Bank pages import from `recruitmentApi`/hooks only. Both files carry a LEGACY boundary header documenting that they remain solely for the **unmigrated** domains: Assessment Builder/Detail/Preview (Task 24C-3), the v2 Scoring Preview, the scoring files (`v2BaseScoring`, `v2ModifierScoring`, `assessmentScoring`), and the candidate placeholder — all explicitly out of 24C-2 scope.
- Applicant assessment rendering, scoring, candidates/CVs, and screening were not touched.

## Tests

- `server/task24c2.questionBankApi.test.ts` (28 tests): pure type-aware validation coverage (trim/weights/bounds/decoys/SJT explanations/overlapping bands/rubric ranges/evidence multipliers + `formatUsedInLabel`) plus a live-TiDB suite booting the real Express router on an ephemeral port: 401 guards (anonymous + authenticated non-Admin viewer), seeded list (14 questions · type counts ORDINAL 3 / MULTI 3 / NUMERIC 2 / SJT 2 / OPEN 3 / EVIDENCE 1 · D1–D8 dimensions · concise rows · 10-per-page pagination), filters and sorting with the used-in label, detail projections for D1.Q1 / D3.Q1 / D2.Q2 / D5.Q1 (raws 5,2,1,−2) / D6.Q1 / D2.Q1E, restrained 404, cross-checks from both sides (D1.Q1↔D1.Q2, D2.Q3→D2.Q2, D4.Q1→D4.Q2 Manual review), transactional create→read→update→lock lifecycle with self-cleaning data, duplicate-reference 400, invalid-payload 400, and assessment-usage type-change protection (asserts D1.Q1 stays ORDINAL).
- `client/src/lib/recruitmentApi.test.ts` (16 tests): Task 24C-1 fetch-layer coverage (public/admin paths, credentials, URL encoding, POST/PATCH shapes, restrained errors, no mock fallback) **merged with** Task 24C-2 coverage (`fetchQuestions` query-string serialization, detail/create/update shapes, restrained 400/404/503 handling).
- Live test values were verified against the seeded TiDB instance (not assumed) before assertions were written.

## Verification results

- `npx tsc --noEmit` — clean.
- `npm test` — **134/134 tests pass** across 13 files (24A, 24B, 24C-1 server + 24C-2 server 28 tests + all client suites), 133s.
- `npm run build` — production build succeeds (existing non-blocking chunk-size advisory only).
- Browser verification against the production build (port 3100): **7/7 PASS** —
  - Auth guard: unauthenticated `/admin/questions` → `/admin/login?next=%2Fadmin%2Fquestions`; session-cookie sign-in works for all Admin pages.
  - List: restrained loading state settling into 14 rows (10 + 4 across two pages), D1–D8 dimension filters, MULTI filter → exactly D3.Q1/D4.Q1/D8.Q1, search D1.Q1 → single row, used-in labels rendered.
  - Detail: D1.Q1 (ORDINAL · weight 3 · close option → G3 with no raw score · integrity cross-check with D1.Q2), D5.Q1 (SJT · 4 options · 5/2/1/−2 with internal explanations), D2.Q1E (paired D2.Q1 · multipliers 1.00/0.95/0.85 · no weight).
  - Create: new ORDINAL `T24C2-BROWSER` (D5 · weight 2 · 4 options 0/2/4/5) saved and rendered on its detail page; Edit: reference locked, values prefilled (never blank defaults), prompt change persisted.
  - Restrained not-found panel for `/admin/questions/does-not-exist`.
  - 24C-1 regression: `/apply` role card renders from the DB; `/admin/roles` list loads from the DB.
  - The browser-created question and its temporary session were removed afterwards; the seed is back to exactly 14 questions.
