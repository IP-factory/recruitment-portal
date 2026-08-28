/**
 * Task 24C-1 — recruitment role references for not-yet-migrated mock domains.
 *
 * Recruitment Roles themselves live in TiDB and are read through the
 * recruitment API. The identifiers below are stable database row ids used by
 * the candidate/assessment mock domains to associate their seeded records
 * with the seeded Business Development Officer role; they are not a local
 * copy of the role configuration.
 */

export const BUSINESS_DEVELOPMENT_OFFICER_ROLE_ID = "role-business-development-officer";
/** Legacy alias retained so existing Admin data contracts remain stable while the visible role title migrates. */
export const BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID = BUSINESS_DEVELOPMENT_OFFICER_ROLE_ID;
