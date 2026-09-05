import { describe, expect, it } from "vitest";
import { screeningRoleKey, screeningRoleOptions } from "./screeningRoles";

describe("screening role identity", () => {
  it("keeps same-title roles separate and deduplicates candidates for one role", () => {
    const roles = [
      { roleId: "role-a", roleTitle: "Analyst" },
      { roleId: "role-b", roleTitle: "Analyst" },
      { roleId: "role-a", roleTitle: "Analyst" },
    ];
    expect(screeningRoleOptions(roles)).toEqual([
      { value: "id:role-a", label: "Analyst (role-a)" },
      { value: "id:role-b", label: "Analyst (role-b)" },
    ]);
    expect(roles.filter((role) => screeningRoleKey(role) === "id:role-a")).toHaveLength(2);
  });

  it("supports older responses without a role ID and keeps historical roles", () => {
    expect(screeningRoleOptions([
      { roleTitle: "Former role" }, { roleTitle: "Former role" }, { roleTitle: "Analyst" },
    ])).toEqual([
      { value: "title:Analyst", label: "Analyst" },
      { value: "title:Former role", label: "Former role" },
    ]);
    expect(screeningRoleOptions([])).toEqual([]);
  });
});
