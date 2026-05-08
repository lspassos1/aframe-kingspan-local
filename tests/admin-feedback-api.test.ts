import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/admin/feedback/route";
import { requireAdminUser } from "@/lib/auth/admin";

vi.mock("@/lib/auth/admin", () => ({
  requireAdminUser: vi.fn(),
}));

const originalEnv = process.env;
const originalFetch = global.fetch;
const requireAdminUserMock = vi.mocked(requireAdminUser);

function feedbackIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    number: 42,
    title: "[Feedback] Melhorar painel admin",
    body: "Nome: Lucas\nContato: lucas@example.com\nCategoria: bug\n\n## Mensagem\nA lista de melhorias precisa explicar melhor as falhas operacionais.\n\n## Privacidade\nAutorizado.",
    html_url: "https://github.com/lspassos1/aframe-kingspan-local/issues/42",
    created_at: "2026-05-07T00:00:00Z",
    updated_at: "2026-05-07T00:10:00Z",
    labels: [],
    ...overrides,
  };
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("/api/admin/feedback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      GITHUB_FEEDBACK_TOKEN: "server-token",
      GITHUB_FEEDBACK_REPO: "lspassos1/aframe-kingspan-local",
    };
    requireAdminUserMock.mockResolvedValue({} as Awaited<ReturnType<typeof requireAdminUser>>);
    global.fetch = originalFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns feedback items for an authorized admin", async () => {
    global.fetch = vi.fn(async () =>
      Response.json([feedbackIssue(), feedbackIssue({ title: "Unrelated issue", number: 99 })])
    ) as unknown as typeof fetch;

    const response = await GET();
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ok");
    expect(payload.items).toMatchObject([
      {
        number: 42,
        name: "Lucas",
        contact: "lucas@example.com",
        category: "bug",
        status: "pending",
      },
    ]);
  });

  it("returns an empty status when GitHub has no feedback issues", async () => {
    global.fetch = vi.fn(async () => Response.json([])) as unknown as typeof fetch;

    const response = await GET();
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe("empty");
    expect(payload.items).toEqual([]);
  });

  it("returns a safe diagnostic when the GitHub token is missing", async () => {
    delete process.env.GITHUB_FEEDBACK_TOKEN;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET();
    const payload = await json(response);

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      status: "missing_token",
      code: "missing_github_feedback_token",
    });
    expect(JSON.stringify(payload)).not.toContain("server-token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a safe diagnostic when GitHub API fails", async () => {
    global.fetch = vi.fn(async () => Response.json({ message: "Bad credentials" }, { status: 401 })) as unknown as typeof fetch;

    const response = await GET();
    const payload = await json(response);

    expect(response.status).toBe(502);
    expect(payload).toMatchObject({
      status: "github_error",
      code: "github-list-failed",
      githubStatus: 401,
    });
    expect(JSON.stringify(payload)).not.toContain("server-token");
  });

  it("blocks users without admin permission", async () => {
    requireAdminUserMock.mockResolvedValue(null);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET();
    const payload = await json(response);

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      status: "forbidden",
      code: "admin_required",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updates feedback status without exposing GitHub credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ name: "feedback-approved" }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ name: "feedback-rejected" }, { status: 422 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json(feedbackIssue()))
      .mockResolvedValueOnce(Response.json([{ name: "feedback-approved" }]))
      .mockResolvedValueOnce(Response.json({ id: 1 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const request = new Request("http://localhost:3000/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueNumber: 42, status: "approved" }),
    }) as unknown as NextRequest;

    const response = await PATCH(request);
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "ok", message: "Status atualizado." });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(JSON.stringify(payload)).not.toContain("server-token");
  });
});
