import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecruitmentApiRouter } from "./recruitmentApi";
import { deleteRecruitmentRole, getRecruitmentRoleByIdOrSlug } from "./recruitmentRepository";

vi.mock("./adminAuth", () => ({
  readSessionToken: (request: express.Request) => request.headers["x-test-session"],
  resolveSession: async (token: string) => token === "expired" ? null : { user: { id: token === "admin" ? 1 : 2 } },
  findAdminProfileForUser: async (id: number) => ({ role: "Admin", status: id === 1 ? "Active" : "Inactive" }),
}));
vi.mock("./recruitmentRepository", async (original) => ({
  ...await original<typeof import("./recruitmentRepository")>(),
  getRecruitmentRoleByIdOrSlug: vi.fn(),
  deleteRecruitmentRole: vi.fn(),
}));

describe("admin role deletion API", () => {
  let server: Server;
  let url: string;
  beforeAll(async () => {
    const app = express();
    app.use(createRecruitmentApiRouter());
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/recruitment-roles/analyst`;
  });
  afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "test-configured-no-database-connection");
    vi.mocked(getRecruitmentRoleByIdOrSlug).mockReset();
    vi.mocked(deleteRecruitmentRole).mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it.each([undefined, "expired", "inactive"])("rejects an unauthorized session (%s) before reading or deleting the role", async (session) => {
    const response = await fetch(url, { method: "DELETE", headers: session ? { "x-test-session": session } : {} });
    expect(response.status).toBe(401);
    expect(getRecruitmentRoleByIdOrSlug).not.toHaveBeenCalled();
    expect(deleteRecruitmentRole).not.toHaveBeenCalled();
  });

  it("resolves a slug and deletes only the resolved role for an active admin", async () => {
    vi.mocked(getRecruitmentRoleByIdOrSlug).mockResolvedValue({ id: "role-a" } as NonNullable<Awaited<ReturnType<typeof getRecruitmentRoleByIdOrSlug>>>);
    vi.mocked(deleteRecruitmentRole).mockResolvedValue(true);
    const response = await fetch(url, { method: "DELETE", headers: { "x-test-session": "admin" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(getRecruitmentRoleByIdOrSlug).toHaveBeenCalledWith("analyst");
    expect(deleteRecruitmentRole).toHaveBeenCalledWith("role-a");
  });

  it("returns 404 for a missing or previously deleted role", async () => {
    vi.mocked(getRecruitmentRoleByIdOrSlug).mockResolvedValue(null);
    const response = await fetch(url, { method: "DELETE", headers: { "x-test-session": "admin" } });
    expect(response.status).toBe(404);
    expect(deleteRecruitmentRole).not.toHaveBeenCalled();
  });

  it("returns a safe error on failure and does not claim success", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getRecruitmentRoleByIdOrSlug).mockRejectedValue(new Error("private SQL details"));
    const response = await fetch(url, { method: "DELETE", headers: { "x-test-session": "admin" } });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "Unable to delete this recruitment role. Please try again." });
  });
});
