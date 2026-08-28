# Task 24D-1 — Live Applicant Runtime Notes

## Database-backed now

The following domains are now persisted in TiDB via the applicant runtime:

- **Application information** — `applications` table stores applicant contact/professional data, role, eligibility status, application status, and applicant token hash
- **Eligibility responses** — `application_eligibility_responses` table stores per-gate evaluation results (G1–G7) with outcome and internal flag
- **Eligibility outcome** — evaluated server-side, stored as `eligibility_status` on the `applications` row
- **Application progress** — `current_step` and `application_status` on the `applications` row survive refresh
- **Live assessment** — applicant-safe questions loaded from TiDB via `assessment_question_assignments`, `assessment_questions`, `question_options`, `numeric_question_configs`, and `open_question_configs`
- **Assessment attempt** — `assessment_attempts` table tracks attempt lifecycle (Not Started → In Progress → Complete)
- **Assessment responses** — `assessment_responses` table stores per-question response payloads with type, elapsed seconds, and timestamps
- **Review data** — assembled from persisted application, eligibility, and assessment data at query time
- **Submission** — `application_status = Submitted` with `submitted_at` timestamp

### New tables

| Table | Purpose |
|-------|---------|
| `applications` | Core application record with applicant info, status, and token hash |
| `application_eligibility_responses` | Per-gate eligibility evaluation results |
| `assessment_attempts` | Assessment attempt lifecycle |
| `assessment_responses` | Per-question response persistence |

### Applicant access model

- Passwordless: cryptographically random 64-char hex token generated at application creation
- Only the SHA-256 hash is stored in `applicant_token_hash`
- Token returned once to the browser, stored in `localStorage`
- `X-Application-Token` header used for all subsequent API calls
- No cookies, no admin session leakage

## API endpoints created

### Public (applicant-facing)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/public/applications` | Create application with server-side eligibility |
| GET | `/api/public/applications/me` | Resume application state |
| GET | `/api/public/applications/me/assessment` | Load applicant-safe assessment |
| PUT | `/api/public/applications/me/assessment/responses/:questionId` | Save/upsert assessment response |
| POST | `/api/public/applications/me/assessment/responses/:questionId/timer` | Start OPEN question timer |
| POST | `/api/public/applications/me/assessment/complete` | Complete assessment |
| POST | `/api/public/applications/me/submit` | Submit application (idempotent) |
| GET | `/api/public/applications/me/review` | Load review data |

### Security guarantees

- Applicant APIs never expose: qWeight, rawScore, score, dimensionWeight, rubric, decoy, verificationMultiplier, internalExplanation, crossCheck, band, floor, bonus, multiplier
- Invalid tokens return safe 403/503 without revealing whether an application exists
- No SQL, stack traces, or database host in error responses
- Server-side eligibility evaluation — never trusts client-computed eligibility
- Server-side response validation against question type configuration

## Stepper changes

The applicant journey now uses a **3-step** flow (CV removed for MVP):

1. **Information** — contact, professional info, and eligibility questions
2. **Assessment** — v2 14-question assessment loaded from TiDB
3. **Review** — persisted application data review and submission

The old `/cv` route redirects to `/assessment`.

## Still pending (24D-2 and beyond)

- CV upload, file storage, review, and scoring
- Automated scoring persistence (question raw scores, dimension scores, Base Score, verification multiplier, integrity penalties, bonus, Final Screening Score, Applied Band)
- OPEN rubric review (Admin manual rating of OPEN responses)
- Admin real applications view (currently using mock data)
- Screening configuration UI
- Shortlisting persistence
- Assessment activation mechanism via Admin UI

## Migration

`0002_task24d1_applicant_runtime.sql` creates:
- `applications` (with `role_email_idx` and `token_hash_idx` indexes)
- `application_eligibility_responses` (with `app_gate_unique` constraint)
- `assessment_attempts` (with `app_assessment_idx`)
- `assessment_responses` (with `attempt_question_unique` constraint)

No existing 24A–24C-3 records are modified.

## File changes summary

### New files
- `shared/applicationApi.ts` — shared DTOs, validation, types
- `server/applicationRepository.ts` — repository layer with eligibility evaluation
- `server/applicationApi.ts` — Express router with all public endpoints
- `client/src/lib/applicationApi.ts` — client API layer with token management
- `server/task24d1.applicationApi.test.ts` — 31 tests covering contracts, eligibility, security
- `drizzle/migrations/0002_task24d1_applicant_runtime.sql` — migration SQL

### Modified files
- `drizzle/schema.ts` — 4 new tables added
- `drizzle/migrations/meta/_journal.json` — migration entry added
- `server/index.ts` — new router registered
- `client/src/lib/applicationData.ts` — APPLICATION_STEPS reduced to 3
- `client/src/components/application/ApplicationShell.tsx` — updated sidebar text
- `client/src/components/application/ApplicantEligibilityGuard.tsx` — token-based auth
- `client/src/pages/ApplicantInformation.tsx` — POST to server
- `client/src/pages/ApplicantAssessmentPlaceholder.tsx` — loads from DB
- `client/src/pages/ApplicantAssessmentQuestionsPlaceholder.tsx` — full DB-backed question runner
- `client/src/pages/ApplicantAssessmentComplete.tsx` — updated step numbers
- `client/src/pages/ApplicantReviewPlaceholder.tsx` — loads review data from DB
- `client/src/pages/ApplicantSubmitted.tsx` — updated step numbers, real submission text
- `client/src/pages/ApplicantEligibilityCloseout.tsx` — minor doc update
- `client/src/App.tsx` — CV route redirects to assessment
