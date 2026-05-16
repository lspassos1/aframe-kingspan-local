import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user_test" })),
}));

vi.mock("@/lib/ai/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/providers")>();
  return {
    ...actual,
    extractPlanWithProviderChain: vi.fn(),
  };
});

import { auth } from "@clerk/nextjs/server";
import {
  getPlanExtractErrorPayload,
  getPlanExtractNoApplicableFieldsPayload,
  POST,
  readRequestedPlanExtractConstructionMethod,
  readRequestedPlanExtractMode,
  serializeProviderErrorsForClient,
} from "@/app/api/ai/plan-extract/route";
import { AiProviderChainError } from "@/lib/ai/errors";
import { extractPlanWithProviderChain } from "@/lib/ai/providers";
import { sanitizeAiDiagnosticMessage } from "@/lib/ai/safe-errors";
import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";

const routePlanResult: PlanExtractResult = {
  version: "1.0",
  summary: "Planta com campos retangulares.",
  confidence: "medium",
  extracted: {
    houseWidthM: 9,
    floorHeightM: 3,
    floors: 2,
    doorCount: 3,
    windowCount: 6,
    notes: ["Campos retangulares detectados."],
  },
  fieldConfidence: {
    houseWidthM: "medium",
    floors: "medium",
  },
  assumptions: [],
  missingInformation: [],
  warnings: [],
};

const routePlanResultWithMethodSuggestion: PlanExtractResult = {
  ...routePlanResult,
  extracted: {
    ...routePlanResult.extracted,
    constructionMethod: "conventional-masonry",
  },
  fieldConfidence: {
    ...routePlanResult.fieldConfidence,
    constructionMethod: "medium",
  },
};

const routePlanEmptyResult: PlanExtractResult = {
  ...routePlanResult,
  extracted: {
    notes: ["Provider encontrou conteúdo, mas não extraiu campos aplicáveis."],
  },
  fieldConfidence: {},
  assumptions: ["A imagem parece ser uma planta baixa."],
  missingInformation: ["Confirmar medidas principais."],
  warnings: [],
};

function createPlanUploadRequest(fileName: string, constructionMethod: string) {
  const formData = new FormData();
  formData.set("aiMode", "paid");
  formData.set("constructionMethod", constructionMethod);
  formData.set("file", new File([`plan-${fileName}`], fileName, { type: "image/png" }));
  return new NextRequest("http://localhost/api/ai/plan-extract", {
    method: "POST",
    body: formData,
  });
}

describe("plan extract route diagnostics", () => {
  beforeEach(() => {
    vi.stubEnv("AI_PLAN_EXTRACT_ENABLED", "true");
    vi.stubEnv("AI_RATE_LIMIT_SALT", "test-salt");
    vi.stubEnv("AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT", "1000");
    vi.stubEnv("AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER", "1000");
    vi.stubEnv("AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP", "1000");
    vi.mocked(auth).mockResolvedValue({ userId: "user_test" } as never);
    vi.mocked(extractPlanWithProviderChain).mockReset();
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

  it("reads only supported construction methods from form data", () => {
    const aframeForm = new FormData();
    aframeForm.set("constructionMethod", "aframe");
    const masonryForm = new FormData();
    masonryForm.set("constructionMethod", "conventional-masonry");
    const invalidForm = new FormData();
    invalidForm.set("constructionMethod", "steel-frame");

    expect(readRequestedPlanExtractConstructionMethod(aframeForm)).toBe("aframe");
    expect(readRequestedPlanExtractConstructionMethod(masonryForm)).toBe("conventional-masonry");
    expect(readRequestedPlanExtractConstructionMethod(invalidForm)).toBeUndefined();
    expect(readRequestedPlanExtractConstructionMethod(null)).toBeUndefined();
  });

  it("uses generic no-applicable-field copy when no construction method was provided", () => {
    expect(getPlanExtractNoApplicableFieldsPayload(undefined)).toMatchObject({
      reason: "plan-extract-empty-result",
      message: "A análise não encontrou campos aplicáveis. Continue manualmente ou tente uma imagem mais legível.",
    });
    expect(getPlanExtractNoApplicableFieldsPayload("aframe")).toMatchObject({
      reason: "plan-extract-no-current-method-fields",
      message: "A análise encontrou dados, mas nenhum campo aplicável ao método atual. Continue manualmente ou tente confirmar o método da planta.",
    });
  });

  it("returns a method-confirmation suggestion when extracted fields need another method", async () => {
    vi.mocked(extractPlanWithProviderChain).mockResolvedValueOnce({
      result: routePlanResult,
      provider: "openai",
      model: "premium-test",
      diagnostics: {
        providerAttempts: [{ provider: "openai", attempt: 1, outcome: "success", durationMs: 10 }],
      },
    });

    const response = await POST(createPlanUploadRequest("aframe-method.png", "aframe"));
    const payload = (await response.json()) as { result?: PlanExtractResult; mode?: string };

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("paid");
    expect(payload.result?.extracted.constructionMethod).toBe("conventional-masonry");
    expect(payload.result?.fieldConfidence.constructionMethod).toBe("medium");
    expect(payload.result?.fieldEvidence.constructionMethod).toContain("confirmar o método construtivo");
    expect(payload.result?.extracted.houseWidthM).toBe(9);
  });

  it("returns prepared method-confirmation results from cache", async () => {
    vi.mocked(extractPlanWithProviderChain).mockResolvedValueOnce({
      result: routePlanResult,
      provider: "openai",
      model: "premium-test",
      diagnostics: {
        providerAttempts: [{ provider: "openai", attempt: 1, outcome: "success", durationMs: 10 }],
      },
    });

    const firstResponse = await POST(createPlanUploadRequest("aframe-method-cache.png", "aframe"));
    const secondResponse = await POST(createPlanUploadRequest("aframe-method-cache.png", "aframe"));
    const firstPayload = (await firstResponse.json()) as { result?: PlanExtractResult; cached?: boolean };
    const secondPayload = (await secondResponse.json()) as { result?: PlanExtractResult; cached?: boolean };

    expect(firstResponse.status).toBe(200);
    expect(firstPayload.result?.extracted.constructionMethod).toBe("conventional-masonry");
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.headers.get("X-AI-Cache")).toBe("HIT");
    expect(secondPayload.cached).toBe(true);
    expect(secondPayload.result?.extracted.constructionMethod).toBe("conventional-masonry");
    expect(extractPlanWithProviderChain).toHaveBeenCalledTimes(1);
  });

  it("rejects provider results with no applicable extracted fields", async () => {
    vi.mocked(extractPlanWithProviderChain).mockResolvedValueOnce({
      result: routePlanEmptyResult,
      provider: "openai",
      model: "premium-test",
      diagnostics: {
        providerAttempts: [{ provider: "openai", attempt: 1, outcome: "success", durationMs: 10 }],
      },
    });

    const response = await POST(createPlanUploadRequest("notes-only-method.png", "aframe"));
    const payload = (await response.json()) as { reason?: string; message?: string; mode?: string };

    expect(response.status).toBe(422);
    expect(payload).toMatchObject({
      reason: "plan-extract-no-current-method-fields",
      mode: "paid",
    });
    expect(payload.message).toContain("nenhum campo aplicável ao método atual");
  });

  it("accepts extracted-method fields when method confirmation makes them reviewable", async () => {
    vi.mocked(extractPlanWithProviderChain).mockResolvedValueOnce({
      result: routePlanResultWithMethodSuggestion,
      provider: "openai",
      model: "premium-test",
      diagnostics: {
        providerAttempts: [{ provider: "openai", attempt: 1, outcome: "success", durationMs: 10 }],
      },
    });

    const response = await POST(createPlanUploadRequest("aframe-method-suggestion.png", "aframe"));
    const payload = (await response.json()) as { result?: PlanExtractResult; mode?: string };

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("paid");
    expect(payload.result?.extracted.constructionMethod).toBe("conventional-masonry");
    expect(payload.result?.extracted.houseWidthM).toBe(9);
  });

  it("accepts extracted fields that are applicable to the current construction method", async () => {
    vi.mocked(extractPlanWithProviderChain).mockResolvedValueOnce({
      result: routePlanResult,
      provider: "openai",
      model: "premium-test",
      diagnostics: {
        providerAttempts: [{ provider: "openai", attempt: 1, outcome: "success", durationMs: 10 }],
      },
    });

    const response = await POST(createPlanUploadRequest("masonry-method.png", "conventional-masonry"));
    const payload = (await response.json()) as { result?: PlanExtractResult; mode?: string };

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("paid");
    expect(payload.result?.extracted.houseWidthM).toBe(9);
    expect(response.headers.get("X-AI-Mode")).toBe("paid");
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
