import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user_test" })),
}));

import { auth } from "@clerk/nextjs/server";
import { getPlanExtractErrorPayload, POST, readRequestedPlanExtractMode, serializeProviderErrorsForClient } from "@/app/api/ai/plan-extract/route";
import { AiProviderChainError } from "@/lib/ai/errors";
import { sanitizeAiDiagnosticMessage } from "@/lib/ai/safe-errors";

describe("plan extract route diagnostics", () => {
  beforeEach(() => {
    vi.stubEnv("AI_PLAN_EXTRACT_ENABLED", "true");
    vi.stubEnv("AI_RATE_LIMIT_SALT", "test-salt");
    vi.mocked(auth).mockResolvedValue({ userId: "user_test" } as never);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("redacts provider URLs and token-like values from safe diagnostics", () => {
    const sanitized = sanitizeAiDiagnosticMessage(
      "Provider failed at https://example.test/path with Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456 and x-api-key=short-key"
    );

    expect(sanitized).toContain("[url]");
    expect(sanitized).toContain("[redacted]");
    expect(sanitized).not.toContain("example.test");
    expect(sanitized).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(sanitized).not.toContain("short-key");
  });

  it("sanitizes provider chain errors before returning them to the client", () => {
    const errors = serializeProviderErrorsForClient([
      {
        provider: "gemini",
        message: "Provider gemini failed at https://generativelanguage.googleapis.com/v1beta with apikey=secret-token",
      },
    ]);

    expect(errors).toEqual([
      {
        provider: "gemini",
        message: "Provider gemini failed at [url] with [redacted]",
      },
    ]);
  });

  it("returns a specific recovery reason when free PDF extraction providers fail", () => {
    const payload = getPlanExtractErrorPayload(
      new AiProviderChainError([
        {
          provider: "gemini",
          message: "Provider gemini failed at https://example.test with x-api-key=secret-token",
        },
      ]),
      { mimeType: "application/pdf", env: { AI_MODE: "free-cloud" } }
    );

    expect(payload).toMatchObject({
      reason: "free-pdf-provider-unavailable",
      message: "Não consegui ler este PDF agora. Exporte a primeira página como imagem ou continue manualmente.",
    });
    expect(JSON.stringify(payload)).not.toContain("example.test");
    expect(JSON.stringify(payload)).not.toContain("secret-token");
  });

  it("returns safe free image failure reasons without exposing provider internals", () => {
    const rateLimitedPayload = getPlanExtractErrorPayload(
      new AiProviderChainError(
        [
          {
            provider: "gemini",
            message: "Provider gemini respondeu 503 at https://example.test with x-api-key=secret-token",
          },
          {
            provider: "openrouter",
            message: "Provider openrouter respondeu 429.",
          },
        ],
        [
          {
            provider: "gemini",
            attempt: 1,
            outcome: "failed",
            durationMs: 20,
            status: 503,
            retryReason: "transient-error",
          },
          {
            provider: "openrouter",
            attempt: 1,
            outcome: "failed",
            durationMs: 20,
            status: 429,
          },
        ]
      ),
      { mimeType: "image/png", env: { AI_MODE: "free-cloud" } }
    );
    const timeoutPayload = getPlanExtractErrorPayload(
      new AiProviderChainError(
        [
          {
            provider: "gemini",
            message: "Provider gemini abort timeout.",
          },
        ],
        [
          {
            provider: "gemini",
            attempt: 1,
            outcome: "failed",
            durationMs: 20,
            retryReason: "timeout",
          },
        ]
      ),
      { mimeType: "image/jpeg", env: { AI_MODE: "free-cloud" } }
    );

    expect(rateLimitedPayload).toMatchObject({
      reason: "free-image-provider-rate-limited",
      message: "A análise gratuita está temporariamente indisponível. Continue manualmente ou tente novamente mais tarde.",
    });
    expect(timeoutPayload).toMatchObject({
      reason: "free-image-provider-timeout",
      message: "A análise gratuita demorou demais. Continue manualmente ou tente uma imagem menor.",
    });
    expect(JSON.stringify(rateLimitedPayload)).not.toContain("example.test");
    expect(JSON.stringify(rateLimitedPayload)).not.toContain("secret-token");
  });

  it("reads only the explicit supported plan extraction modes from form data", () => {
    const freeForm = new FormData();
    freeForm.set("aiMode", "free-cloud");
    const paidForm = new FormData();
    paidForm.set("aiMode", "paid");
    const invalidForm = new FormData();
    invalidForm.set("aiMode", "openai");

    expect(readRequestedPlanExtractMode(freeForm)).toBe("free-cloud");
    expect(readRequestedPlanExtractMode(paidForm)).toBe("paid");
    expect(readRequestedPlanExtractMode(invalidForm)).toBe("free-cloud");
    expect(readRequestedPlanExtractMode(null)).toBe("free-cloud");
  });

  it("returns a safe diagnostic id on upload validation errors", async () => {
    const request = new NextRequest("http://localhost/api/ai/plan-extract", {
      method: "POST",
      body: new FormData(),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { diagnosticId?: string; message?: string };

    expect(response.status).toBe(400);
    expect(payload.message).toBe("Envie um arquivo de planta baixa.");
    expect(payload.diagnosticId).toMatch(/^diag_[a-zA-Z0-9_-]+$/);
    expect(response.headers.get("X-AI-Diagnostic-Id")).toBe(payload.diagnosticId);
  });

  it("returns a diagnostic id before the feature-disabled guard", async () => {
    vi.stubEnv("AI_PLAN_EXTRACT_ENABLED", "false");
    const disabledResponse = await POST(
      new NextRequest("http://localhost/api/ai/plan-extract", {
        method: "POST",
        body: new FormData(),
      })
    );
    const disabledPayload = (await disabledResponse.json()) as { diagnosticId?: string };

    expect(disabledResponse.status).toBe(403);
    expect(disabledPayload.diagnosticId).toMatch(/^diag_[a-zA-Z0-9_-]+$/);
    expect(disabledResponse.headers.get("X-AI-Diagnostic-Id")).toBe(disabledPayload.diagnosticId);
  });

  it("returns a diagnostic id before the auth-required guard", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const authResponse = await POST(
      new NextRequest("http://localhost/api/ai/plan-extract", {
        method: "POST",
        body: new FormData(),
      })
    );
    const authPayload = (await authResponse.json()) as { diagnosticId?: string };

    expect(authResponse.status).toBe(401);
    expect(authPayload.diagnosticId).toMatch(/^diag_[a-zA-Z0-9_-]+$/);
    expect(authResponse.headers.get("X-AI-Diagnostic-Id")).toBe(authPayload.diagnosticId);
  });
});
