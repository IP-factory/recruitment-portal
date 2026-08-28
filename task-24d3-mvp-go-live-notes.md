# Task 24D-3 — MVP Go-Live Notes

## Included in MVP

- **Role application** — `/apply/business-development-officer`
- **Eligibility** — server-side evaluation of G1–G7 (G4/G5 remain `Configuration Required` non-blocking)
- **14-question v2 assessment** — exact approved order (D1.Q1, D3.Q1, D2.Q3, D4.Q1, D4.Q2, D3.Q3, D5.Q1, D2.Q1, D2.Q1E, D7.Q1, D1.Q2, D6.Q1, D8.Q1, D2.Q2)
- **Persistent responses** — `assessment_attempts` + `assessment_responses` in TiDB
- **Refresh-resume** — applicant progress survives browser refresh
- **Manual OPEN grading** — D2.Q1, D4.Q2, D6.Q1 admin-rated 0–5 with rubric anchors
- **Server-authoritative scoring** — client never sends authoritative scores
- **D1–D8 dimension normalisation** — weighted formula bounded 0–100
- **Verification multiplier** — EVIDENCE-driven (1.00, 0.95, 0.85)
- **Integrity review** — D1.Q1↔D1.Q2, D2.Q3↔D2.Q2 deterministic; D4.Q1↔D4.Q2 manual; `Confirmed` = −10 per flag; 2+ flags → Manual Review Required
- **Bonus review** — +3 / +2 / +2 capped at +5
- **Final Screening Score** — `FINAL = (BASE × V) − P + B` bounded 0–100
- **Raw Band / Applied Band** — dimension floors (D1≥50, D2≥40, D5≥50) cap Applied Band to C
- **Admin Applications** — real TiDB list with filters, search, sort, pagination
- **Candidate Detail** — Overview, Assessment (with OPEN review cards), Integrity & Bonus tabs
- **Screening** — default sort: Final Score highest-first; Shortlist, Hold, Close actions
- **Dashboard** — real TiDB counts (Total, Submitted, Pending Review, Shortlisted)
- **Shortlist persistence** — `application_shortlist` table, admin attribution
- **Recruitment status persistence** — Submitted / Under Review / Shortlisted / Hold / Closed

## Deferred (post-MVP)

- CV upload, file storage, and review
- CV Score / CV Evidence Score / Overall Fit / Combined CV+Assessment score
- Automatic CV analysis
- Admin user-management UI / SuperAdmin
- Email notifications on status change
- Bulk candidate actions
- Full audit-log product
- Expanded ~24-question assessment
- Forgot-password flow
- Analytics product work
- AI review / grading
- Screening configuration UI
- Assessment activation UI (operator script is provided)

---

## Activation & seed state

### BDO v2 assessment

- **Slug:** `business-development-officer-assessment-v2`
- **Version:** 2
- **Status:** `Active` (after running `scripts/activate-bdo-v2-assessment.ts`)
- **14 assignments** in exact approved order
- **All assigned questions** `Active`

### BDO role

- **Slug:** `business-development-officer`
- **Status:** `Open`

### Eligibility

- G1–G7 present
- G4 / G5 = `Configuration Required` (non-blocking)

### Legacy assessment

The legacy 5-question applicant assessment is **not served** to new applicants. The
applicant runtime loads only the `Active` assessment for the selected role.

---

## Security summary

| Concern | Mitigation |
|---------|-----------|
| Admin password | Salted scrypt hash; plaintext never stored, logged, or bundled |
| Session token | 32-byte random; only SHA-256 hash persisted in `auth_sessions` |
| Admin cookie | `app_session_id`: `HttpOnly; SameSite=Lax; Path=/`; `Secure` in production |
| Admin HTML cache | `/admin*` → `Cache-Control: no-store` |
| Sign-out | Server-side session revocation + cookie clear |
| Applicant token | 64-byte random; only SHA-256 hash in `applications.applicant_token_hash` |
| Applicant isolation | Invalid/unknown token returns safe 403/503; cannot enumerate |
| Body size | 100 KB JSON limit across all API routes |
| Error responses | Never include SQL, stack traces, or credentials |
| Public Admin registration | None exists |
| Secrets in client build | None (verified: `DATABASE_URL`, passwords, session secrets absent from `dist/public`) |

---

## Analytics & Manus artifacts

- Removed the unresolved `%VITE_ANALYTICS_ENDPOINT%/umami` script from `client/index.html`
- Removed `client/public/__manus__/debug-collector.js` (dev-only debug collector)
- `vitePluginManusDebugCollector` already gated on non-production: does not inject in build mode
- Production build no longer emits analytics/unresolved-placeholder warnings

---

## Environment variables

See [.env.example](.env.example) for the full list.

**Required:**
- `DATABASE_URL`

**Optional with defaults:**
- `NODE_ENV` (default `development`)
- `PORT` (default `3100`)
- `TRUST_PROXY` (set to `1` behind TLS-terminating reverse proxy)

**Optional (Manus OAuth):**
- `OAUTH_PORTAL_URL`, `OAUTH_TOKEN_URL`, `OAUTH_CLIENT_SECRET`, `APP_ID`

**Provisioning-time only (never stored):**
- `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_FULL_NAME`

---

## Test state at go-live

- **Total tests:** 226
- **Files:** 16
- **Failures:** 0
- **TypeScript:** 0 errors
- **Production build:** success (chunk advisory non-blocking)
- **Repeatable:** running the full suite twice leaves no stale state

Tests assert post-activation production state (BDO v2 `Active` is the expected
state; `Draft` is tolerated before the activation script has been run).

---

## Production commands

```bash
npm ci                                          # install
npx drizzle-kit migrate                         # run migrations
ADMIN_PASSWORD='<pw>' npx tsx scripts/provision-task24b-admin.ts   # provision Admin
npx tsx scripts/activate-bdo-v2-assessment.ts   # activate BDO v2
npm run build                                   # build client + server
NODE_ENV=production npm start                   # start production server
curl -f http://<host>:<port>/api/health/database  # health check
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full procedure, rollback notes, and
security checklist.

---

## What was NOT changed in 24D-3

- No new features (per spec)
- No CV work
- No email, forgot-password, SuperAdmin, or analytics product
- No scoring changes (formula, bands, floors, caps all unchanged from 24D-2)
- No UI redesign — only targeted hardening fixes
