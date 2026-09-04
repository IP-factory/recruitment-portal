/**
 * Resolve the human-readable role title for the applicant shell.
 *
 * Priority order:
 *  1. If the applicant has a valid session for THIS role, use state.roleTitle.
 *  2. Otherwise, fetch the public role by slug.
 *  3. Fall back to empty string while loading — the shell shows a neutral
 *     placeholder ("Application") rather than defaulting to BDO.
 *
 * This hook never surfaces an error to the UI; the shell degrades gracefully
 * with an empty title rather than blocking the applicant flow.
 */
import { fetchPublicRole } from "@/lib/recruitmentApi";
import {
  ApplicationApiError,
  fetchApplication,
  loadApplicantSession,
} from "@/lib/applicationApi";
import { useEffect, useState } from "react";

export function useApplicantRoleTitle(roleSlug: string): string {
  const [roleTitle, setRoleTitle] = useState<string>("");

  useEffect(() => {
    if (!roleSlug) return;
    let cancelled = false;

    const tryPublicRole = () =>
      fetchPublicRole(roleSlug)
        .then((role) => { if (!cancelled) setRoleTitle(role.title); })
        .catch(() => {});

    const session = loadApplicantSession();

    if (session) {
      fetchApplication()
        .then((state) => {
          if (cancelled) return;
          if (state.roleSlug === roleSlug && state.roleTitle) {
            setRoleTitle(state.roleTitle);
          } else {
            // Session is for a different role — use the public API instead.
            void tryPublicRole();
          }
        })
        .catch((err: unknown) => {
          // Session invalid, token expired, or network error — fall back to public role.
          if (!(err instanceof ApplicationApiError) || err.status >= 500) {
            void tryPublicRole();
          }
        });
    } else {
      void tryPublicRole();
    }

    return () => { cancelled = true; };
  }, [roleSlug]);

  return roleTitle;
}
