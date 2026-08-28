/**
 * Task 24B — shared Admin authorization contract.
 *
 * Pure, deterministic authorization rules shared by the server (session
 * endpoints) and the client (route guard). Authentication alone never grants
 * Admin access: an Active Admin profile with a permitted role must also exist.
 */

export const ADMIN_PROFILE_ROLE = "Admin" as const;
export const ADMIN_PROFILE_STATUSES = ["Active", "Inactive"] as const;

export type AdminProfileRole = typeof ADMIN_PROFILE_ROLE;
export type AdminProfileStatus = (typeof ADMIN_PROFILE_STATUSES)[number];

/** Authenticated user summary exposed by the session endpoint. */
export interface AdminSessionUser {
  id: number;
  email: string | null;
  name: string | null;
}

/** Admin profile authorization metadata (never credentials). */
export interface AdminProfileSummary {
  id: string;
  email: string;
  fullName: string | null;
  role: AdminProfileRole;
  status: AdminProfileStatus;
}

/** Session endpoint payload; authorization internals are never exposed. */
export interface AdminSessionPayload {
  authenticated: boolean;
  authorized: boolean;
  user: AdminSessionUser | null;
  profile: AdminProfileSummary | null;
}

export type AdminAuthorizationOutcome =
  | "authorized"
  | "unauthenticated"
  | "missing-profile"
  | "inactive-profile"
  | "role-not-permitted";

export interface AdminProfileRecordLike {
  role: string;
  status: string;
}

/**
 * Evaluate Admin access for a resolved session. All four conditions must hold:
 * 1. a valid authenticated session (user present),
 * 2. a matching Admin profile exists,
 * 3. the profile status is Active,
 * 4. the profile role permits Admin access.
 *
 * The outcome codes are internal-only; public responses must collapse every
 * non-authorized outcome into a single restrained presentation.
 */
export function evaluateAdminAuthorization(
  user: { id: number } | null | undefined,
  profile: AdminProfileRecordLike | null | undefined,
): AdminAuthorizationOutcome {
  if (!user) return "unauthenticated";
  if (!profile) return "missing-profile";
  if (profile.status !== "Active") return "inactive-profile";
  if (profile.role !== ADMIN_PROFILE_ROLE) return "role-not-permitted";
  return "authorized";
}

export function isAdminAuthorized(
  user: { id: number } | null | undefined,
  profile: AdminProfileRecordLike | null | undefined,
): boolean {
  return evaluateAdminAuthorization(user, profile) === "authorized";
}
