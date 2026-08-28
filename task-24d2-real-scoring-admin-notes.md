# Task 24D-2 — Real Scoring + Admin Applications Notes

## Overview

Task 24D-2 replaces the Admin mock-data pages (Applications, Candidate Detail, Screening, Dashboard) with live TiDB data and implements the full v2 evaluation pipeline: objective question scoring, dimension normalisation, OPEN rubric review, integrity cross-checks, bonus calculation, dimension floors, band resolution, and shortlisting.

The scoring logic is entirely server-authoritative: the client never sends authoritative scores. The Admin UI reads computed evaluations and allows controlled mutations (OPEN rating, integrity confirm/dismiss, bonus confirmation, shortlist, status).

## Scoring pipeline

### Formula

```
FINAL_SCREENING_SCORE = (BASE × V) − P + B
  bounded to [0, 100]

where
  BASE  = Base Assessment Score (weighted dimension normalised scores)
  V     = Verification multiplier (from EVIDENCE question, default 1.00)
  P     = Integrity penalty (10 per Confirmed flag)
  B     = Bonus (sum of confirmed bonuses, capped at +5)
```

### Objective question scoring

| Question type | Scoring rule |
|---------------|--------------|
| ORDINAL | Option `raw_score` looked up by selected option id |
| MULTI | Sum of selected option `raw_score` (including -1 decoys), floored at 0, capped at `maxScore` |
| NUMERIC | Calendar-year or attainment-% mode → derived value → scoring band → raw score |
| SJT | Option `raw_score` with negative values preserved |
| EVIDENCE | No raw points; contributes to `verification_multiplier` only |
| OPEN | Admin-reviewed; raw score 0–5 from rubric-anchored rating |

### Dimension normalisation

```
dimensionScore = [ Σ((q.raw / q.max) × q.qWeight) / Σ(q.qWeight) ] × 100
bounded 0–100
```

8 dimensions (D1–D8) with weights totalling 100%. Pending OPEN questions cause the dimension status to be `Pending` and defer the evaluation status to `Pending OPEN Review`.

### Base Assessment Score

```
BASE = Σ (dimensionScore × dimensionWeight / 100)
```

### Verification multiplier

- Sourced from the EVIDENCE question option's `verification_multiplier` column
- Values: 1.00, 0.95, 0.85 depending on evidence strength
- Non-EVIDENCE questions return `null`

### Integrity cross-checks

| Pair | Type |
|------|------|
| D1.Q1 ↔ D1.Q2 | Deterministic |
| D2.Q3 ↔ D2.Q2 | Deterministic |
| D4.Q1 ↔ D4.Q2 | Manual review |

- `Flagged` → no penalty (pending admin review)
- `Confirmed` → −10 penalty per flag
- `Dismissed` → no penalty
- 2+ Confirmed flags → `manual_review_required = 1`, evaluation status becomes `Manual Review Required`

### Bonus

| Code | Points |
|------|--------|
| `diplomatic-account` | +3 |
| `french-arabic` | +2 |
| `commercial-certification` | +2 |

Raw sum capped at `BONUS_CAP = 5`. Only admin-confirmed bonuses contribute.

### Dimension floors

| Dimension | Floor |
|-----------|-------|
| D1 | ≥ 50 |
| D2 | ≥ 40 |
| D5 | ≥ 50 |

Missing any floor caps the Applied Band to C, regardless of the Raw Band. Raw Band remains visible separately.

### Band thresholds

| Band | Range |
|------|-------|
| A | 80–100 |
| B | 65–79 |
| C | 50–64 |
| D | below 50 |

### Evaluation statuses

- `Pending Assessment` — applicant has not completed the assessment
- `Pending OPEN Review` — objective scoring complete, OPEN ratings still required
- `Scored` — full evaluation computed
- `Manual Review Required` — 2+ confirmed integrity flags

## Database

`0003_task24d2_scoring_admin.sql` creates 6 new tables:

| Table | Purpose |
|-------|---------|
| `open_response_reviews` | Admin rubric ratings (0–5) for OPEN questions, one per response×question |
| `application_integrity_flags` | Per-application integrity flags with Clear/Flagged/Confirmed/Dismissed lifecycle |
| `application_bonus_reviews` | Per-bonus-type confirmation state with admin reference |
| `application_evaluations` | Central evaluation record: BASE, V, P, B, final score, raw band, applied band, status |
| `application_dimension_scores` | Per-dimension normalised score, weight, weighted contribution, floor status |
| `application_shortlist` | Shortlist persistence with admin attribution |

All tables cascade to `applications` so a deleted application removes the derived evaluation chain. Admin references use `ON DELETE SET NULL` to survive admin profile removal.

## Admin API endpoints

All endpoints under `/api/admin/applications` require Task 24B Admin authorisation (`app_session_id` HttpOnly cookie, `requireAuthorizedAdmin` middleware).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/applications` | List applications with filter/sort/pagination |
| GET | `/api/admin/applications/:id` | Candidate detail (application, eligibility, assessment, evaluation) |
| GET | `/api/admin/applications/:id/evaluation` | Full evaluation with dimension scores and flags |
| PUT | `/api/admin/applications/:id/open-reviews/:questionId` | Save OPEN rubric rating (0–5) + note |
| PUT | `/api/admin/applications/:id/integrity/:flagId` | Confirm or Dismiss integrity flag |
| PUT | `/api/admin/applications/:id/bonuses/:bonusType` | Confirm/dismiss bonus |
| PUT | `/api/admin/applications/:id/shortlist` | Toggle shortlist |
| PUT | `/api/admin/applications/:id/status` | Change application status |

On each scoring-affecting mutation (OPEN review, integrity, bonus), the server calls `recalculateAndPersistEvaluation` which re-runs the full pipeline and persists updated dimension scores and the evaluation row.

## Security

- All endpoints gated by `requireAuthorizedAdmin` (Task 24B)
- Unauthenticated requests return 401 with `{ ok: false, error: "..." }`
- Error responses never include SQL, stack traces, or credentials
- Server-authoritative scoring — client sends only rubric ratings, confirm/dismiss decisions, and status changes
- Input validation via shared `validate*Input` functions before any DB mutation
- OPEN rating bounds: integer 0–5; integrity status: Confirmed | Dismissed only; bonus: confirmed boolean

## Client pages

### Admin Applications (`AdminApplications.tsx`)

- Real TiDB application list
- Summary cards: Total, Submitted, Pending Review, Shortlisted
- Filters: search (name/email), application status, eligibility
- Sort: candidateName, finalScore, appliedBand, applicationStatus, appliedDate
- Pagination (PAGE_SIZE = 10)
- Columns: Candidate, Role, Eligibility, Assessment, Final Score, Applied Band, Status, Applied, Action

### Candidate Detail (`AdminCandidatePlaceholder.tsx`)

Three tabs:

1. **Overview** — contact/professional info, eligibility outcomes (G1–G7), ScreeningEvaluationCard with D1–D8 dimension profile radar
2. **Assessment** — 14 question responses; OPEN questions get inline review cards with 0–5 rubric rating, note, Save button; reviewed questions show stored score
3. **Integrity & Bonus** — integrity flag list with Confirm/Dismiss (Confirmed = −10); bonus confirmation (+3, +2, +2 capped at +5)

Header includes: avatar, name, email, role, date, status dropdown, shortlist toggle, Manual Review Required warning when 2+ confirmed flags.

### Screening (`AdminScreening.tsx`)

- Real TiDB candidates
- Default sort: `final-score-desc` (highest-scoring candidates on the first page)
- Pending scores sort below scored candidates (null treated as −1)
- Shortlist, Hold, Close actions with confirmation dialog
- Filters: search, status, band, shortlist

### Dashboard (`AdminDashboard.tsx`)

- Real TiDB counts: Total Applications, Submitted, Pending Review, Shortlisted
- Recent applications table (top 5 by date)
- Graceful degradation on API failure

## Client API layer

`client/src/lib/adminApplicationApi.ts` exposes:

- `fetchAdminApplications(params)` — list with filter/sort/pagination
- `fetchAdminApplicationDetail(id)` — full candidate detail
- `recalculateEvaluation(id)` — force re-score
- `saveOpenReview(id, questionId, payload)` — save OPEN rubric rating
- `updateIntegrityFlag(id, flagId, payload)` — confirm/dismiss flag
- `updateBonus(id, bonusType, payload)` — confirm/dismiss bonus
- `updateShortlist(id, payload)` — toggle shortlist
- `updateApplicationStatus(id, payload)` — change status

Re-exports shared types and constants from `shared/adminApplicationApi.ts`.

## File changes summary

### New files

- `shared/adminApplicationApi.ts` (291 lines) — shared types, validation, constants, band/floor helpers
- `server/evaluationScoring.ts` (762 lines) — centralised scoring pipeline
- `server/adminApplicationApi.ts` (604 lines) — Admin Application API router
- `client/src/lib/adminApplicationApi.ts` (159 lines) — client API layer
- `server/task24d2.scoringAdmin.test.ts` (495 lines) — 47 tests across 12 describe blocks
- `drizzle/migrations/0003_task24d2_scoring_admin.sql` (113 lines) — migration SQL

### Modified files

- `drizzle/schema.ts` — 6 new tables added
- `drizzle/migrations/meta/_journal.json` — migration entry added
- `server/index.ts` — new router registered
- `client/src/pages/AdminApplications.tsx` — rewritten to use real TiDB data
- `client/src/pages/AdminCandidatePlaceholder.tsx` — rewritten with Overview/Assessment/Integrity tabs
- `client/src/pages/AdminScreening.tsx` — rewritten to use real TiDB data with highest-score-first sort
- `client/src/pages/AdminDashboard.tsx` — rewritten with real TiDB counts

## Tests

`server/task24d2.scoringAdmin.test.ts` — 47 tests covering:

1. Input validation (OPEN, integrity, bonus, shortlist, status)
2. Scoring helpers (`resolveBand`, `calculateFinalScore`, `applyFloorCap`)
3. Scoring constants (weights total 100, bonus cap, penalty, floors)
4. Objective question scoring (ORDINAL, MULTI, NUMERIC, SJT, EVIDENCE)
5. Verification multiplier
6. Dimension normalisation (weighted formula, OPEN integration, pending status)
7. Integrity cross-checks (penalty logic, Manual Review Required trigger)
8. Bonus calculation (cap logic)
9. Dimension floors (D1, D2, D5 cap to C)
10. Full evaluation flow (Pending Assessment, Pending OPEN Review, Scored, penalty)
11. Security: unauthenticated rejection, safe error shapes
12. Sorting: scored above pending when highest-first

All 47 new tests pass. Full suite: 221 passed, 5 failed (all pre-existing 24C-2/24C-3 database state issues, none introduced by 24D-2).

## Migration

`0003_task24d2_scoring_admin.sql` is additive — no existing 24A–24D-1 records are modified. Safe to apply on top of `0002_task24d1_applicant_runtime.sql`.

## Deferred (beyond 24D-2)

- CV upload, file storage, and CV-scoring integration
- Screening configuration UI
- Assessment activation mechanism via Admin UI
- Bulk shortlist operations
- Email notifications on status change
- Audit log for scoring mutations




