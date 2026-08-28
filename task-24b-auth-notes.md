# Task 24B — Replace Demo Admin Login with Real Authentication

Completed 2026-08-28. The frontend-only demo Admin session (`admin@gmail.com` / `123456` compared in client code, session kept in localStorage) has been replaced with real server-side authentication backed by the native project auth tables.

## What changed

### Removed (demo auth)

- Plaintext credential comparison and the localStorage session in `client/src/lib/adminSession.ts`.
- Hard-coded `admin@gmail.com` identity copy in the Admin shell; the top bar now renders session/profile data.
- The legacy demo localStorage key is actively cleared on load so no surviving demo grant persists.

### Schema (migration `0001_task24b_admin_auth`)

- `users.password_hash` — nullable; only a salted scrypt hash is ever stored.
- `admin_profiles` — authorization metadata only: `id`, `auth_user_id` (UNIQUE, references `users.id` with cascade), `email`, `full_name` (nullable), `role`, `status`, `created_at`, `updated_at`. No credential columns.
- `auth_sessions` — stores SHA-256 token hashes only (never the raw token), user reference, expiry; sign-out revokes the row.

### Server (`server/adminAuth.ts`, mounted in `server/index.ts`)

- Salted scrypt hashing (`scrypt:N:r:p:salt:hash`, timing-safe comparison, dummy-hash equalizer for unknown emails).
- Endpoints: `GET /api/admin/session`, `POST /api/admin/auth/sign-in`, `POST /api/admin/auth/sign-out`, `GET /api/oauth/callback` (native Manus OAuth scaffold — authentication via SSO still requires an Active Admin profile to be authorized).
- Session carrier: HttpOnly `SameSite=Lax` `app_session_id` cookie (native cookie name from `shared/const.ts`).
- Authorization rule (`shared/adminAuth.ts`, shared with client tests): authorized only when valid session + matching `admin_profiles` row + `status = Active` + `role = Admin`.
- `/admin*` HTML responses are served with `Cache-Control: no-store` so Back navigation after sign-out cannot restore protected content.

### Client

- `client/src/lib/adminSession.ts` — fetch-based session client; localStorage is never the source of truth.
- `client/src/lib/adminAuthGuards.ts` — pure route decisions (redirect-to-login with preserved `next`, access-unavailable, render) with open-redirect protection.
- `client/src/contexts/AdminAuthContext.tsx` — session provider, `AdminRoute` guard wrapper, restrained "Access unavailable" state with Sign out.
- `AdminLogin` keeps the approved visual design (Email, Password, Sign in, loading state, visibility toggle, inline validation) and shows only the non-enumerating error "Unable to sign in with those details."
- All `/admin/*` routes in `App.tsx` are wrapped by the guard; already-authorized Admins visiting `/admin/login` are redirected to their destination or `/admin`.

## Initial Admin provisioning

Automated safely: the password is supplied by the operator through the environment and is never written to source, seed files, logs, or the database (only the scrypt hash is persisted).

```bash
ADMIN_PASSWORD='<strong password>' npx tsx scripts/provision-task24b-admin.ts
# optional: ADMIN_EMAIL=<email> ADMIN_FULL_NAME=<name>
```

- Default email `admin@gmail.com`; the old demo password and passwords under 12 characters are rejected.
- Idempotent: re-running rotates the password and keeps the profile Active.
- Initial Admin was provisioned in this task: `admin@gmail.com` → user 30001, Active Admin profile `admin-profile-8e63e5fda6bfcdfed9814eb1`. The generated password was delivered once to the operator and is stored nowhere in the repository.

## Untouched (per spec)

Mock data, recruitment configuration pages, scoring, Assessment v2 (stays Draft/Inactive), and all applicant UX. The applicant flow remains passwordless; legacy `/auth/*` pages are isolated from Admin authentication.

## Tests

- `client/src/lib/task24b.adminAuth.test.ts` — deterministic scenarios A–H (redirect, sign-in, invalid credentials, missing/inactive profile, nested routes, sign-out, login-page redirect) plus return-path sanitization.
- `server/task24b.auth.test.ts` — hashing, cookie contract, OAuth state, redirect safety, session payload; live-DB suite verifies `admin_profiles` has no credential columns, unique `auth_user_id`, and the credential lifecycle (skipped without `DATABASE_URL`; `vitest.config.ts` loads the root `.env`).

## Verification results

- `tsc --noEmit`: clean.
- `vitest run`: 68/68 passed across 10 files, including live database authorization schema tests.
- `npm run build`: production build succeeds.
- Endpoint smoke test against the production server: unauthenticated session JSON, demo password rejected (401), provisioned credentials authorized, session persists via cookie, sign-out revokes the session, `/admin*` served `no-store`.
- Browser verification: all six flow checks passed (redirect with preserved destination, inline error on wrong credentials, sign-in to dashboard with real identity, persisted protected access, sign-out + Back button does not restore content, re-redirect when signed out).
