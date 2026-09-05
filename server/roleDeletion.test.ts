import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import type { Pool } from "mysql2/promise";
import { getDatabase } from "./db";
import { deleteRecruitmentRole, getRecruitmentRoleById, getRecruitmentRoleBySlug, listRecruitmentRoles } from "./recruitmentRepository";

vi.mock("./db", () => ({ getDatabase: vi.fn() }));
const query = vi.fn();

beforeEach(() => {
  query.mockReset();
  vi.mocked(getDatabase).mockReturnValue(drizzle({ query } as unknown as Pool));
});

describe("role deletion preserves recruitment history", () => {
  it("uses one conditional update, archives the role and never deletes related records", async () => {
    query.mockResolvedValue([{ affectedRows: 1 }, []]);
    expect(await deleteRecruitmentRole("role-a")).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    const [statement, values] = query.mock.calls[0];
    expect(statement.sql).toMatch(/^update `recruitment_roles` set `deleted_at` = \?, `status` = \?/);
    expect(statement.sql).toContain("`recruitment_roles`.`id` = ?");
    expect(statement.sql).toContain("`recruitment_roles`.`deleted_at` is null");
    expect(values).toContain("Archived");
    expect(values).toContain("role-a");
    expect(statement.sql).not.toMatch(/delete from|applications|assessment_responses|application_evaluations/);
  });

  it("reports a missing or previously deleted role without overwriting its deletion time", async () => {
    query.mockResolvedValue([{ affectedRows: 0 }, []]);
    expect(await deleteRecruitmentRole("missing")).toBe(false);
  });

  it("excludes deleted roles from lists and direct role lookups while retaining normal archived roles", async () => {
    query.mockResolvedValue([[], []]);
    expect(await listRecruitmentRoles()).toEqual([]);
    expect(await getRecruitmentRoleById("role-a")).toBeNull();
    expect(await getRecruitmentRoleBySlug("analyst")).toBeNull();
    for (const [statement] of query.mock.calls) {
      expect(statement.sql).toContain("`recruitment_roles`.`deleted_at` is null");
      expect(statement.sql).not.toMatch(/`status` (?:!=|<>|=)/);
    }
  });

  it("propagates database failures so the API cannot report a successful deletion", async () => {
    query.mockRejectedValue(new Error("database unavailable"));
    await expect(deleteRecruitmentRole("role-a")).rejects.toThrow();
  });
});
