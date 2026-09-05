import type { AdminApplicationSummary } from "@shared/adminApplicationApi";

type ApplicationRole = Pick<AdminApplicationSummary, "roleId" | "roleTitle">;

export function screeningRoleKey(application: ApplicationRole): string {
  return application.roleId ? `id:${application.roleId}` : `title:${application.roleTitle}`;
}

/** Keep historical roles available, including roles removed from recruitment. */
export function screeningRoleOptions(applications: ApplicationRole[]) {
  const roles = new Map<string, string>();
  for (const application of applications) roles.set(screeningRoleKey(application), application.roleTitle);
  const titleCounts = new Map<string, number>();
  for (const title of Array.from(roles.values())) titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
  return Array.from(roles, ([value, title]) => ({
    value,
    label: titleCounts.get(title)! > 1 ? `${title} (${value.slice(value.indexOf(":") + 1)})` : title,
  })).sort((a, b) => a.label.localeCompare(b.label));
}
