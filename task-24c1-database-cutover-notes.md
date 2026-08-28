# Task 24C-1 — Cut Over Role, Eligibility and Evaluation Framework to the Database

**Date:** 2026-08-28
**Scope:** Recruitment Role (read + write), Eligibility configuration (read), Evaluation Framework (read). TiDB becomes the runtime source of truth for these three domains; frontend mocks are retired for them.

## Architecture

`React client → /api → Express → recruitmentRepository → Drizzle → TiDB`

- All database access happens server-side. `client/src` contains **no** database imports; the only connection input is `process.env.DATABASE_URL` (loaded via `dotenv` in `server/index.ts`).
- Shared contract module: `shared/recruitmentApi.ts` (DTO types, server-authoritative validation, slug/summary/band/date helpers) used by the Express router, the client API module, and the tests.
- Server layers: `server/recruitmentRepository.ts` (testable Drizzle access + public/admin projections) and `server/recruitmentApi.ts` (Express router). Mounted in `server/index.ts` alongside the Task 24B auth router.
- Client layers: `client/src/lib/recruitmentApi.ts` (fetch module, `credentials: "include"`, `{ ok:false, error }` handling via `RecruitmentApiError`) and `client/src/hooks/useRecruitmentData.ts` (`useAsyncData` + convenience hooks). Loading/error UI: `client/src/components/AsyncStates.tsx`.
- **No mock fallback anywhere**: failures surface as a visible, restrained error state with retry — never `databaseData ?? mockData`.

## Endpoints

### Public (applicant-safe)
| Method | Path | Behavior |
|---|---|---|
| GET | `/api/public/recruitment-roles` | Open + Closed roles only; Draft/Archived hidden |
| GET | `/api/public/recruitment-roles/:slug` | 404 unless slug exists and status is Open/Closed |
| GET | `/api/public/recruitment-roles/:slug/eligibility` | Gate wording + state; only G3 exposes `minimumYears` |

Public projections never expose database IDs, `updatedAt`, weights, floors, bands, verification multipliers, integrity penalties, bonus configuration, or gate `configuration` JSON.

### Admin (Task 24B authorization)
All guarded by `requireAuthorizedAdmin` = valid session + Active Admin profile + Admin role (reuses `readSessionToken` / `resolveSession` / `findAdminProfileForUser` / `isAdminAuthorized`; no second auth system). Unauthorized → `401 { ok:false, error:"Admin authorization is required." }`.

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/admin/recruitment-roles` | All statuses, with ids + `updatedAt` |
| POST | `/api/admin/recruitment-roles` | Validated via `validateRecruitmentRoleInput`; unique slug allocation; 201 |
| GET | `/api/admin/recruitment-roles/:idOrSlug` | Lookup by database id **or** slug |
| PATCH | `/api/admin/recruitment-roles/:idOrSlug` | Metadata-only update (gates/dimensions/assessments untouched) |
| GET | `/api/admin/recruitment-roles/:idOrSlug/eligibility` | Full gate rows incl. `configuration` + `displayOrder` |
| GET | `/api/admin/recruitment-roles/:idOrSlug/evaluation-framework` | Dimensions, floors, screening (verification, bonus, bands, integrity penalty, bonus cap, manual review rules) |

Errors always use the restrained JSON shape `{ ok:false, error }`; unexpected failures → 503 "Unable to load recruitment data." with server-side-only logging.

## Client cutover (approved UI preserved — no redesign)

- **`/apply`** (`Apply.tsx`): role list from `usePublicRoles`; loading/error/empty states; navigates to `/apply/${role.slug}`; Closed roles listed with disabled Apply.
- **Applicant Information** (`ApplicantInformation.tsx`): fetches public eligibility config, derives `minimumYears` from the experience gate (no hard-coded "3"), passes it as the third argument to `evaluateApplicantEligibility`. Submit is gated on configuration load; load failure renders `DataErrorState` with retry.
- **Admin Roles list** (`AdminRoles.tsx`): `useAdminRoles`; application counts derived from the (unmigrated) mock application domain matched by role title; Last Updated via `formatRoleUpdatedLabel`.
- **Admin Role Detail** (`AdminRoleDetail.tsx`): `useAdminRole` + `useAdminEligibility`; gate summary via `deriveEligibilityGateSummary` ("5 active gates · 2 configuration required", amber when configuration required).
- **Admin Role Form** (`AdminRoleForm.tsx`): create/update against the API with client-side + server-side validation; Cancel/back from an edit returns to the role detail.
- **Evaluation Framework tab** (`V2EvaluationFrameworkTab.tsx`): accepts `roleSlug`, renders DB framework — D1–D8 weights/floors, verification multipliers, integrity penalty, bonus cap, bands — via `useEvaluationFramework`. Only the descriptive `V2_PIPELINE_STEPS` copy remains local.
- Role selectors in **AdminScreening** and **AdminAssessmentBuilder**, and role titles in **AdminAssessments** / **AdminAssessmentDetail**, now resolve from `useAdminRoles`.

## Mock retirement

- `client/src/lib/adminRoleData.ts` **deleted**; zero remaining references.
- `getAssessmentRole` removed from `adminAssessmentData.ts`; pages resolve role titles via the API.
- Stable role-id constants for the **unmigrated** mock domains moved to `client/src/lib/recruitmentRoleReferences.ts` (`adminAssessmentData`, `cvEvidenceScoring`, `roleCvCriteriaData`, `candidateCvEvidenceData`).
- `v2EvaluationFramework.ts` local constants remain only for the unmigrated candidate scoring preview (`AdminCandidatePlaceholder`) and their own tests — the Admin display surface is DB-backed.
- Not migrated (intentionally): Question Bank, Assessment Builder, applicant applications, candidate profiles, CV files, assessment responses, scoring results, screening candidates, shortlist state, review notes, OPEN rubric reviews. Eligibility **answers** stay frontend-local.

## Tests

- `server/task24c1.recruitmentApi.test.ts` (21 tests): pure contract helpers (validation, slugs, gate summary, band ranges, date labels) plus a live-TiDB suite that boots the real Express router on an ephemeral port and covers public A–E, admin F–J (401 guards incl. authenticated non-Admin viewer, list, create/update/lookup/slug-uniqueness, eligibility, framework values), Draft-hidden regression, and no-scoring-leak regression. Test data self-cleans.
- `client/src/lib/recruitmentApi.test.ts` (8 tests): deterministic fetch-layer contract — credentials, URL encoding, POST/PATCH shapes, error message surfacing, `RecruitmentApiError` typing.
- `client/src/lib/eligibilityData.test.ts`: evaluator now takes the gate configuration as a third argument; new test proves the G3 minimum years come from configuration, not a hard-coded value.
- `vitest.config.ts`: `fileParallelism: false` — DB suites share one remote TiDB instance; parallel files intermittently exceeded its connection budget.

## Verification results

- `npx tsc --noEmit` — clean.
- `npm test` — **98/98 tests pass** across 12 files (Task 24A, 24B, 24C-1 server + all client suites), 47s.
- `npm run build` — production build succeeds (existing non-blocking chunk-size advisory only).
- Browser verification against the production build (port 3100): **13/13 effective passes** —
  - `/apply` role card renders from the DB; applying proceeds through the Information step to the CV step with no configuration errors. The Role Eligibility section shows the approved applicant set (4 interactive questions + the relevant-experience note); G4/G5 stay absent because they are seeded "Configuration Required" — by design, with the existing "confirmed against the role configuration when available" note.
  - Admin sign-in/out regression intact (`admin@gmail.com`); unauthenticated `/admin/*` redirects to `/admin/login?next=…`.
  - `/admin/roles`, role detail ("5 active gates · 2 configuration required"), edit prefill with no-save Cancel, and create-form validation all DB-backed.
  - Evaluation Framework tab displays exactly: weights 22/18/14/12/12/8/8/6 (total 100), floors D1=50/D2=40/D5=50, verification 1.00 · 0.95 · 0.85, integrity −10, bonus maximum +5, bands A 80–100 / B 65–79 / C 50–64 / D Below 50.

## Role status semantics (regression-safe)

- **Open** — listed publicly, applications accepted.
- **Closed** — listed publicly, Apply disabled.
- **Draft / Archived** — hidden from all public endpoints (404 on detail/eligibility), visible to authorized Admins only.
