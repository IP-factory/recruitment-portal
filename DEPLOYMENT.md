# Deployment — Recruitment Portal (MVP)

This document is the single source of truth for deploying the recruitment portal
to a production environment. It assumes a Node.js 20+ runtime with access to a
TiDB/MySQL database.

---

## Role deletion update

Before deploying the admin role-deletion feature, apply the tracked migration
`0009_soft_delete_recruitment_roles.sql` to add the nullable `deleted_at` column.
Run the normal migration procedure below and verify that the column exists
before starting the updated server. Existing application versions tolerate
this additive column, so apply the migration before deploying the code.

For existing installations with manually applied migration history, use the
targeted, repeatable command `npm run db:migrate:role-deletion`. It loads `.env`,
adds the column only if missing, verifies the role-list query, and records
migration 0009 without replaying unrelated migrations.

Deleting a role sets its deletion timestamp and changes its status to Archived.
It does not delete any applications, CV files, evaluations, assessment questions
or configuration. Deleted roles are excluded from recruitment lists and direct
role-management lookups; historical applications remain available to admins.
Ordinary Archived roles remain visible in role management.

The historical `0008_widen_eligibility_response_gate_columns.sql` file is
documented as manually applied and is not in the existing migration journal;
this release leaves that history unchanged. Migration 0009 is tracked.

## Prerequisites

- **Node.js** ≥ 20 (LTS recommended)
- **npm** (matches `package-lock.json`) — the project's `packageManager` field
  references `pnpm`, but either works. Use `npm ci` for reproducible installs.
- **TiDB / MySQL-compatible database** with TLS support
- **Network access** from the application host to the database host

---

## Required environment variables

Only `DATABASE_URL` is required. All other variables are optional with sane defaults.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | TiDB/MySQL connection URL |
| `NODE_ENV` | ❌ | `development` | Set to `production` in deployed environments |
| `PORT` | ❌ | `3100` | Express listen port |
| `TRUST_PROXY` | ❌ | unset | Set to `1` behind a TLS-terminating reverse proxy so Express honours `X-Forwarded-Proto` and sends `Secure` cookies |
| `OAUTH_PORTAL_URL` | ❌ | — | Manus OAuth portal base URL (only if SSO is used) |
| `OAUTH_TOKEN_URL` | ❌ | `${OAUTH_PORTAL_URL}/token` | OAuth token endpoint |
| `OAUTH_CLIENT_SECRET` | ❌ | — | OAuth client secret (only if SSO is used) |
| `APP_ID` | ❌ | — | Manus application id (only if SSO is used) |

**Provision-time only (never stored):**

| Variable | Description |
|----------|-------------|
| `ADMIN_PASSWORD` | Operator-chosen strong password (≥ 12 chars). Never written to source, logs, or the database as plaintext. |
| `ADMIN_EMAIL` | Optional — defaults to `admin@gmail.com` |
| `ADMIN_FULL_NAME` | Optional display name for the Admin profile |

Copy [.env.example](.env.example) to `.env` and populate values. Do **not**
commit `.env` to source control.

---

## Deployment procedure

### 1. Install dependencies

```bash
npm ci
```

### 2. Run database migrations

```bash
npx drizzle-kit migrate
```

This applies the tracked migrations in order:

1. `0000_big_luminals.sql` — Task 24A foundation (roles, gates, dimensions, questions)
2. `0001_task24b_admin_auth.sql` — Task 24B Admin auth tables
3. `0002_task24d1_applicant_runtime.sql` — Task 24D-1 applications, eligibility, attempts, responses
4. `0003_task24d2_scoring_admin.sql` — Task 24D-2 scoring, reviews, shortlist

Migrations are additive and idempotent-safe. Never run destructive seed logic
against existing production data.

### 2a. Verify migrations are recorded

`drizzle-kit migrate` has been observed to exit silently on TiDB when a DDL
statement fails (e.g. FK parent missing due to statement ordering). After
migrate completes, confirm every migration is recorded in the tracking table:

```bash
mysql "$DATABASE_URL" -e "SELECT id, LEFT(hash, 16) AS hash, created_at FROM __drizzle_migrations ORDER BY created_at;"
```

Expected: 4 rows, one per migration, with SHA-256 hashes matching the local
`.sql` files (`shasum -a 256 drizzle/migrations/*.sql`). If a migration is
missing from `__drizzle_migrations` but its tables also do not exist, apply
the SQL file directly and record the hash manually — the schema is the source
of truth, not Drizzle's migrate tool:

```sql
SET FOREIGN_KEY_CHECKS = 0;
SOURCE drizzle/migrations/0002_task24d1_applicant_runtime.sql;
SET FOREIGN_KEY_CHECKS = 1;
INSERT INTO __drizzle_migrations (hash, created_at)
  VALUES ('<sha256 of the .sql file>', UNIX_TIMESTAMP() * 1000);
```

After the fix, `GET /api/admin/applications` with a valid admin session must
return `200 {"ok":true,"applications":[...],"counts":{...}}`. A `503` with
the browser-safe message "Unable to load applications." almost always means
a migration is missing; inspect the server logs for the structured
`[admin-app] list applications failed:` JSON which walks the error cause
chain and surfaces `code`, `errno`, `sqlState`, and `sqlMessage` (never
sent to the browser).

### 3. Provision / rotate the Admin credential

```bash
ADMIN_PASSWORD='<operator-chosen strong password>' \
  [ADMIN_EMAIL='<email>'] \
  [ADMIN_FULL_NAME='<name>'] \
  npx tsx scripts/provision-task24b-admin.ts
```

This command is idempotent: it creates or updates the `users` row and Active
Admin profile for the target email. The old demo password `123456` is rejected.

### 4. Activate the BDO v2 assessment

```bash
npx tsx scripts/activate-bdo-v2-assessment.ts
```

Safety checks before promoting `Draft → Active`:

- BDO role exists and is `Open`
- v2 assessment exists with `version = 2`
- Exactly 14 assignments in the exact approved order
- All assigned questions are `Active`
- No duplicate assignments (re-verified; also enforced by unique indexes)
- No conflicting `Active` assessment exists for the same role

The script is idempotent: if the assessment is already `Active` and valid, it
reports success without mutation.

### 5. Build

```bash
npm run build
```

Produces `dist/public` (static frontend) and `dist/index.js` (Node bundle).

### 6. Start

```bash
NODE_ENV=production npm start
```

Or equivalently:

```bash
NODE_ENV=production node dist/index.js
```

The production server:

- Starts Express
- Serves the built React client from `dist/public`
- Mounts all `/api/*` routers
- Respects `process.env.PORT` (default `3100`)

Do **not** run Vite as the production server.

### 7. Health check

```bash
curl -f http://<host>:<port>/api/health/database
```

Expected response:

```json
{ "ok": true, "database": "connected" }
```

On failure:

```json
{ "ok": false, "database": "unreachable" }
```

Never exposes credentials, hosts, or raw SQL errors.

### 8. Smoke test

Public:

- `/apply`
- `/apply/business-development-officer`

Admin:

- `/admin/login`
- `/admin`
- `/admin/applications`
- `/admin/screening`
- `/admin/roles`
- `/admin/questions`
- `/admin/assessments`

Sign in with the provisioned Admin credential, create a test application, verify
it appears in Admin Applications and Screening.

---

## Rollback procedure

If the application fails to start after deployment:

1. Stop the current process
2. Restore the previous `dist/` build artifact (keep one prior build available)
3. Re-run `npm start` with the previous build
4. Database migrations are tracked by Drizzle; to roll back a schema change,
   restore a prior database backup and rerun migrations up to that point. Do
   **not** attempt to reverse destructive DDL manually against production data.
5. If the activation script changed assessment status, manually revert:

   ```sql
   UPDATE assessments SET status = 'Draft'
     WHERE slug = 'business-development-officer-assessment-v2' AND version = 2;
   ```

---

## Development workflow

```bash
npm run dev
```

Runs Vite (frontend on `:3000`) and `tsx watch server/index.ts` (backend on
`:3100`) concurrently. The Vite dev server proxies `/api/*` to Express so
HttpOnly session cookies stay on the same origin.

---

## Testing

```bash
npm run test      # vitest run
npm run check     # tsc --noEmit
```

Full suite must pass with 0 failures before deployment.

---

## Security checklist

- ✅ Password stored as salted scrypt hash — never plaintext
- ✅ Session token: 32-byte random; only SHA-256 hash persisted
- ✅ `app_session_id` cookie: `HttpOnly; SameSite=Lax; Path=/`
- ✅ `Secure` cookie flag added automatically when `NODE_ENV=production`
- ✅ `/admin/*` HTML is `Cache-Control: no-store`
- ✅ Sign-out revokes the session token server-side
- ✅ Applicant token: 64-byte random; only SHA-256 hash persisted
- ✅ No secrets (DB credentials, Admin password, session tokens) in `dist/public`
- ✅ JSON body limit: 100 KB across all API routes
- ✅ Error responses never leak SQL, stack traces, or credentials
- ✅ No public Admin registration flow
