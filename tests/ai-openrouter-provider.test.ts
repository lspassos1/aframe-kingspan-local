import { describe, expect, it } from "vitest";
import {
  callOpenRouterPlanReviewProvider,
  extractPlanWithProviderChain,
  getAiPlanReviewProviderConfig,
  type AiPlanExtractProviderConfig,
} from "@/lib/ai/providers";
import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";

const primaryResult: PlanExtractResult = {
  version: "1.0",
  summary: "Leitura Gemini primaria.",
  confidence: "medium",
  extracted: {
    city: "Curitiba",
    state: "PR",
    builtAreaM2: 96,
    houseWidthM: 8,
    houseDepthM: 12,
    floors: 1,
    notes: [],
  },
  fieldConfidence: {
    builtAreaM2: "medium",
    city: "medium",
    houseWidthM: "medium",
  },
  assumptions: [],
  missingInformation: [],
  warnings: [],
};

const reviewResult: PlanExtractResult = {
  ...primaryResult,
  summary: "Segunda leitura OpenRouter.",
  confidence: "high",
  providerMeta: {
    provider: "openrouter",
    model: "google/gemini-2.0-flash-exp:free",
    tokens: 88,
  },
};

const openRouterConfig: AiPlanExtractProviderConfig = {
  id: "openrouter",
  model: "google/gemini-2.0-flash-exp:free",
  configured: true,
  baseUrl: "https://openrouter.ai/api/v1/chat/completions",
  apiKey: "openrouter-key",
  supports: ["image/png", "image/jpeg", "image/webp"],
};

describe("OpenRouter plan review provider", () => {
  it("configures OpenRouter as a free-cloud plan-review provider without PDF support", () => {
    expect(
      getAiPlanReviewProviderConfig({
        AI_MODE: "free-cloud",
        AI_PLAN_REVIEW_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "openrouter-key",
        OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free",
      })
    ).toMatchObject({
      id: "openrouter",
      model: "google/gemini-2.0-flash-exp:free",
      configured: true,
      supports: ["image/png", "image/jpeg", "image/webp"],
    });
  });

  it("calls OpenRouter with a free model, bearer auth and JSON response mode", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(reviewResult) } }],
          usage: { total_tokens: 88 },
        }),
        { status: 200 }
      );
    };

    const result = await callOpenRouterPlanReviewProvider(
      openRouterConfig,
      {
        mimeType: "image/png",
        fileBase64: "abc",
      },
      fetchMock
    );

    const call = calls[0];
    expect(call?.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(new Headers(call?.init?.headers).get("Authorization")).toBe("Bearer openrouter-key");
    const body = JSON.parse(String(call?.init?.body));
    expect(body).toMatchObject({
      model: "google/gemini-2.0-flash-exp:free",
      response_format: { type: "json_object" },
    });
    expect(body.messages[0]?.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: "image_url" })]));
    expect(result).toMatchObject({
      provider: "openrouter",
      model: "google/gemini-2.0-flash-exp:free",
      tokens: 88,
    });
  });

  it("runs OpenRouter as second reading and records consensus without changing structured values", async () => {
    const result = await extractPlanWithProviderChain(
      {
        mimeType: "image/png",
        fileBase64: "abc",
      },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_PRIMARY_PROVIDER: "gemini",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          GEMINI_API_KEY: "gemini-key",
          GEMINI_MODEL: "gemini-2.5-flash",
          OPENROUTER_API_KEY: "openrouter-key",
          OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free",
        },
        async callProvider(provider) {
          return {
            result: primaryResult,
            provider: provider.id,
            model: provider.model,
          };
        },
        async callReviewProvider(provider) {
          return {
            result: reviewResult,
            provider: provider.id,
            model: provider.model,
            tokens: 88,
          };
        },
      }
    );

    expect(result.provider).toBe("gemini");
    expect(result.result.extracted).toEqual(primaryResult.extracted);
    expect(result.result.fieldConfidence.builtAreaM2).toBe("high");
    expect(result.review).toMatchObject({
      status: "completed",
      provider: "openrouter",
      model: "google/gemini-2.0-flash-exp:free",
      tokens: 88,
      comparison: {
        agreements: expect.arrayContaining([expect.objectContaining({ field: "builtAreaM2" })]),
        divergences: [],
      },
    });
  });

  it("marks OpenRouter divergence as pending human review", async () => {
    const divergentReview: PlanExtractResult = {
      ...reviewResult,
      extracted: {
        ...reviewResult.extracted,
        builtAreaM2: 120,
      },
    };

    const result = await extractPlanWithProviderChain(
      {
        mimeType: "image/png",
        fileBase64: "abc",
      },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_PRIMARY_PROVIDER: "gemini",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          GEMINI_API_KEY: "gemini-key",
          OPENROUTER_API_KEY: "openrouter-key",
          OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free",
        },
        async callProvider(provider) {
          return {
            result: primaryResult,
            provider: provider.id,
            model: provider.model,
          };
        },
        async callReviewProvider(provider) {
          return {
            result: divergentReview,
            provider: provider.id,
            model: provider.model,
          };
        },
      }
    );

    expect(result.result.extracted.builtAreaM2).toBe(96);
    expect(result.review?.comparison?.divergences).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "builtAreaM2", reviewValue: 120 })])
    );
    expect(result.result.extractionWarnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "multi_model_divergence", target: "builtAreaM2" })])
    );
  });

  it("continues with Gemini when OpenRouter is unavailable", async () => {
    const result = await extractPlanWithProviderChain(
      {
        mimeType: "image/png",
        fileBase64: "abc",
      },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_PRIMARY_PROVIDER: "gemini",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          GEMINI_API_KEY: "gemini-key",
          OPENROUTER_API_KEY: "openrouter-key",
          OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free",
        },
        async callProvider(provider) {
          return {
            result: primaryResult,
            provider: provider.id,
            model: provider.model,
          };
        },
        async callReviewProvider() {
          throw new Error("Provider openrouter respondeu 429.");
        },
      }
    );

    expect(result.provider).toBe("gemini");
    expect(result.result).toBe(primaryResult);
    expect(result.review).toMatchObject({
      status: "unavailable",
      provider: "openrouter",
      error: { message: "Provider openrouter respondeu 429.", retryable: true },
    });
  });

  it("marks missing OpenRouter credentials as deterministic review unavailability", async () => {
    let reviewCalls = 0;
    const result = await extractPlanWithProviderChain(
      {
        mimeType: "image/png",
        fileBase64: "abc",
      },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_PRIMARY_PROVIDER: "gemini",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          GEMINI_API_KEY: "gemini-key",
          OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free",
        },
        async callProvider(provider) {
          return {
            result: primaryResult,
            provider: provider.id,
            model: provider.model,
          };
        },
        async callReviewProvider() {
          reviewCalls += 1;
          throw new Error("should not call unconfigured review provider");
        },
      }
    );

    expect(reviewCalls).toBe(0);
    expect(result.review).toMatchObject({
      status: "unavailable",
      error: { code: "ai-provider-not-configured", retryable: false },
    });
  });

  it("marks deterministic OpenRouter 4xx review failures as non-retryable", async () => {
    const result = await extractPlanWithProviderChain(
      {
        mimeType: "image/png",
        fileBase64: "abc",
      },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_PRIMARY_PROVIDER: "gemini",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          GEMINI_API_KEY: "gemini-key",
          OPENROUTER_API_KEY: "openrouter-key",
          OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free",
        },
        async callProvider(provider) {
          return {
            result: primaryResult,
            provider: provider.id,
            model: provider.model,
          };
        },
        async callReviewProvider(provider, input) {
          return callOpenRouterPlanReviewProvider(provider, input, async () => new Response("bad request", { status: 400 }));
        },
      }
    );

    expect(result.review).toMatchObject({
      status: "unavailable",
      provider: "openrouter",
      error: { message: "Provider openrouter respondeu 400.", retryable: false },
    });
  });

  it("reuses the injected provider stub for the review path by default", async () => {
    const calledProviders: string[] = [];

    const result = await extractPlanWithProviderChain(
      {
        mimeType: "image/png",
        fileBase64: "abc",
      },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_PRIMARY_PROVIDER: "gemini",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          GEMINI_API_KEY: "gemini-key",
          OPENROUTER_API_KEY: "openrouter-key",
          OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free",
        },
        async callProvider(provider) {
          calledProviders.push(provider.id);
          return {
            result: provider.id === "openrouter" ? reviewResult : primaryResult,
            provider: provider.id,
            model: provider.model,
          };
        },
      }
    );

    expect(calledProviders).toEqual(["gemini", "openrouter"]);
    expect(result.review).toMatchObject({
      status: "completed",
      provider: "openrouter",
    });
  });

  it("blocks paid OpenRouter review models without calling the review provider", async () => {
    let reviewCalls = 0;
    const result = await extractPlanWithProviderChain(
      {
        mimeType: "image/png",
        fileBase64: "abc",
      },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_PRIMARY_PROVIDER: "gemini",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          GEMINI_API_KEY: "gemini-key",
          OPENROUTER_API_KEY: "openrouter-key",
          OPENROUTER_PLAN_REVIEW_MODEL: "openai/gpt-4o",
        },
        async callProvider(provider) {
          return {
            result: primaryResult,
            provider: provider.id,
            model: provider.model,
          };
        },
        async callReviewProvider() {
          reviewCalls += 1;
          throw new Error("should not call paid model");
        },
      }
    );

    expect(reviewCalls).toBe(0);
    expect(result.provider).toBe("gemini");
    expect(result.review).toMatchObject({
      status: "unavailable",
      error: {
        code: "ai-paid-model-blocked",
        retryable: false,
      },
    });
  });

  it("skips OpenRouter second reading for PDFs because the router does not claim generic PDF support", async () => {
    let reviewCalls = 0;
    const result = await extractPlanWithProviderChain(
      {
        mimeType: "application/pdf",
        fileBase64: "abc",
      },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_PLAN_PRIMARY_PROVIDER: "gemini",
          AI_PLAN_REVIEW_PROVIDER: "openrouter",
          GEMINI_API_KEY: "gemini-key",
          OPENROUTER_API_KEY: "openrouter-key",
          OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free",
        },
        async callProvider(provider) {
          return {
            result: primaryResult,
            provider: provider.id,
            model: provider.model,
          };
        },
        async callReviewProvider() {
          reviewCalls += 1;
          throw new Error("should not review PDFs");
        },
      }
    );

    expect(reviewCalls).toBe(0);
    expect(result.review).toMatchObject({
      status: "skipped",
      provider: "openrouter",
      error: { code: "ai-provider-capability-mismatch", retryable: false },
    });
  });
});
