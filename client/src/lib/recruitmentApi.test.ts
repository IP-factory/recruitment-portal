/**
 * Client recruitment API module tests.
 *
 * Task 24C-1 coverage (Roles / Eligibility / Evaluation Framework) and
 * Task 24C-2 coverage (Question Bank): verifies the fetch layer builds the
 * correct requests (paths, query strings, methods, bodies), unwraps the
 * restrained envelopes, and that failures surface as a RecruitmentApiError
 * carrying the server's restrained message — never a silent fallback to mock
 * configuration.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAdminRole,
  createQuestion,
  fetchAdminEligibility,
  fetchAdminRoles,
  fetchEvaluationFramework,
  fetchOpenRoles,
  fetchPublicEligibility,
  fetchQuestion,
  fetchQuestions,
  RecruitmentApiError,
  updateAdminRole,
  updateQuestion,
} from "@/lib/recruitmentApi";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status, body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Task 24C-1: public endpoints ─────────────────────────────────────────────

describe("public endpoints", () => {
  it("fetchOpenRoles unwraps the roles payload and includes credentials", async () => {
    const roles = [{ slug: "business-development-officer", title: "Business Development Officer" }];
    const fetchMock = stubFetch({ roles });
    const result = await fetchOpenRoles();
    expect(result).toEqual(roles);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/public/recruitment-roles");
    expect(init.credentials).toBe("include");
  });

  it("fetchPublicEligibility URL-encodes the role slug", async () => {
    const fetchMock = stubFetch({ roleId: "r1", gates: [] });
    await fetchPublicEligibility("a b");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/public/recruitment-roles/a%20b/eligibility");
  });
});

// ── Task 24C-1: admin endpoints ──────────────────────────────────────────────

describe("admin endpoints", () => {
  it("createAdminRole POSTs the JSON input and returns the created role", async () => {
    const input = { title: "New Role", status: "Draft" } as any;
    const role = { id: "r1", ...input };
    const fetchMock = stubFetch({ role }, 201);
    const result = await createAdminRole(input);
    expect(result).toEqual(role);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/recruitment-roles");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(input);
  });

  it("updateAdminRole PATCHes the role by id or slug", async () => {
    const input = { title: "Revised Role", status: "Open" } as any;
    const role = { id: "r1", ...input };
    const fetchMock = stubFetch({ role });
    const result = await updateAdminRole("r1", input);
    expect(result).toEqual(role);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/recruitment-roles/r1");
    expect(init.method).toBe("PATCH");
  });

  it("targets the documented admin paths for roles, eligibility and framework", async () => {
    stubFetch({ roles: [] });
    await fetchAdminRoles();
    await fetchAdminEligibility("business-development-officer");
    await fetchEvaluationFramework("business-development-officer");
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/recruitment-roles");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/admin/recruitment-roles/business-development-officer/eligibility");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/admin/recruitment-roles/business-development-officer/evaluation-framework");
  });
});

// ── Task 24C-1: error handling — never fall back to mock data ────────────────

describe("error handling — never fall back to mock data", () => {
  it("surfaces the server's restrained 401 message", async () => {
    stubFetch({ ok: false, error: "Admin authorization is required." }, 401);
    await expect(fetchAdminRoles()).rejects.toMatchObject({ status: 401, message: "Admin authorization is required." });
  });

  it("falls back to a restrained message when the body is not JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<html>oops</html>", { status: 502, headers: { "Content-Type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchOpenRoles()).rejects.toMatchObject({ status: 502, message: "Unable to load recruitment data." });
  });

  it("throws a RecruitmentApiError instance", async () => {
    stubFetch({ ok: false, error: "Nope." }, 400);
    await expect(fetchAdminRoles()).rejects.toBeInstanceOf(RecruitmentApiError);
  });
});

// ── Task 24C-2: Question Bank endpoints ──────────────────────────────────────

describe("fetchQuestions", () => {
  const emptyList = { ok: true, items: [], total: 0, page: 1, pageSize: 10, totalPages: 1, dimensions: [], summary: { total: 0, active: 0, dimensionCount: 0 } };

  it("requests the list endpoint and serializes only provided filters", async () => {
    const fetchMock = stubFetch(emptyList);
    await fetchQuestions({ search: "D1", dimension: "D1", type: "ORDINAL", status: "Active", sortKey: "reference", sortDirection: "desc", page: 2, pageSize: 25 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/questions?search=D1&dimension=D1&type=ORDINAL&status=Active&sortKey=reference&sortDirection=desc&page=2&pageSize=25");
    expect(init.credentials).toBe("include");
  });

  it("omits the query string when no filters are provided", async () => {
    const fetchMock = stubFetch(emptyList);
    await fetchQuestions();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/questions");
  });
});

describe("fetchQuestion / createQuestion / updateQuestion", () => {
  it("unwraps the single question payload", async () => {
    const question = { id: "q1", reference: "D1.Q1" };
    const fetchMock = stubFetch({ ok: true, question });
    const result = await fetchQuestion("D1.Q1");
    expect(result).toEqual(question);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/questions/D1.Q1");
  });

  it("POSTs the create payload and returns the created question", async () => {
    const created = { id: "q-new", reference: "T.NEW" };
    const fetchMock = stubFetch({ ok: true, question: created }, 201);
    const input = { reference: "T.NEW", dimensionReference: null, required: true, prompt: "P", helpText: "", status: "Active", timeLimitSec: null, type: "GATE", options: [{ text: "Yes", outcomeType: "pass" }] } as any;
    const result = await createQuestion(input);
    expect(result).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/questions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(input);
  });

  it("PATCHes the update payload to the question id", async () => {
    const updated = { id: "q1", reference: "D1.Q1", prompt: "Revised" };
    const fetchMock = stubFetch({ ok: true, question: updated });
    const input = { reference: "D1.Q1", prompt: "Revised" } as any;
    const result = await updateQuestion("q1", input);
    expect(result).toEqual(updated);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/questions/q1");
    expect(init.method).toBe("PATCH");
  });
});

describe("Question Bank error handling", () => {
  it("throws a RecruitmentApiError carrying the restrained server message", async () => {
    stubFetch({ ok: false, error: "A question with reference \"D1.Q1\" already exists." }, 400);
    await expect(fetchQuestion("D1.Q1")).rejects.toMatchObject({ status: 400, message: "A question with reference \"D1.Q1\" already exists." });
  });

  it("falls back to a restrained message when the body has no error", async () => {
    stubFetch({}, 503);
    await expect(fetchQuestions()).rejects.toMatchObject({ status: 503, message: "Unable to load recruitment data." });
  });

  it("exposes the status so callers can treat 404 as not-found", async () => {
    stubFetch({ ok: false, error: "Unable to load this question." }, 404);
    try {
      await fetchQuestion("missing");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RecruitmentApiError);
      expect((error as RecruitmentApiError).status).toBe(404);
    }
  });
});
