import { describe, expect, it } from "vitest";
import {
  createMemoryPlanExtractCacheStore,
  createPlanExtractCacheKey,
  getPlanExtractCacheTtlSeconds,
  getPlanExtractCacheVersion,
  shouldCachePlanExtractResult,
} from "@/lib/ai/plan-extract-cache";
import type { AiPlanExtractProviderResult } from "@/lib/ai/providers";

const encoder = new TextEncoder();

const validExtraction: AiPlanExtractProviderResult = {
  provider: "openai",
  model: "gpt-4o-mini",
  tokens: 120,
  result: {
    version: "1.0",
    summary: "Planta retangular preliminar.",
    confidence: "medium",
    extracted: {
      city: "Salvador",
      state: "BA",
      notes: [],
    },
    fieldConfidence: {
      city: "high",
      state: "high",
    },
    assumptions: [],
    missingInformation: [],
    warnings: [],
  },
};

describe("AI plan extract cache", () => {
  it("uses file bytes, mime type and provider version in cache keys", () => {
    const fileBytes = encoder.encode("same floor plan");
    const baseEnv = {
      AI_MODE: "paid",
      OPENAI_API_KEY: "key",
      AI_OPENAI_MODEL: "gpt-4o-mini",
    };

    const first = createPlanExtractCacheKey({ fileBytes, mimeType: "image/png", env: baseEnv });
    const same = createPlanExtractCacheKey({ fileBytes, mimeType: "image/png", env: baseEnv });
    const differentModel = createPlanExtractCacheKey({
      fileBytes,
      mimeType: "image/png",
      env: { ...baseEnv, AI_OPENAI_MODEL: "gpt-4.1-mini" },
    });
    const differentMime = createPlanExtractCacheKey({ fileBytes, mimeType: "application/pdf", env: baseEnv });

    expect(first.key).toBe(same.key);
    expect(first.key).not.toBe(differentModel.key);
    expect(first.key).not.toBe(differentMime.key);
    expect(first.fileHash).toHaveLength(64);
    expect(first.versionHash).toHaveLength(24);
  });

  it("allows an explicit cache version override", () => {
    expect(getPlanExtractCacheVersion({ AI_PLAN_EXTRACT_CACHE_VERSION: "manual-v2" })).toBe("manual-v2");
  });

  it("varies cache versions for invalid free-cloud review configuration", () => {
    const baseEnv = {
      AI_MODE: "free-cloud",
      AI_PLAN_PRIMARY_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: "gemini-2.5-flash",
      OPENROUTER_API_KEY: "openrouter-key",
    };

    expect(getPlanExtractCacheVersion({ ...baseEnv, OPENROUTER_PLAN_REVIEW_MODEL: "openai/gpt-4o" })).not.toBe(
      getPlanExtractCacheVersion({ ...baseEnv, OPENROUTER_PLAN_REVIEW_MODEL: "anthropic/claude-3-haiku" })
    );
    expect(getPlanExtractCacheVersion({ ...baseEnv, OPENROUTER_PLAN_REVIEW_MODEL: "openai/gpt-4o" })).not.toBe(
      getPlanExtractCacheVersion({ ...baseEnv, OPENROUTER_PLAN_REVIEW_MODEL: "google/gemini-2.0-flash-exp:free" })
    );
  });

  it("uses a 24 hour TTL by default and accepts hour overrides", () => {
    expect(getPlanExtractCacheTtlSeconds({})).toBe(86_400);
    expect(getPlanExtractCacheTtlSeconds({ AI_PLAN_EXTRACT_CACHE_TTL_HOURS: "2" })).toBe(7_200);
  });

  it("returns only valid cached extraction results", async () => {
    const entries = new Map();
    const store = createMemoryPlanExtractCacheStore(entries);

    await store.set("valid-key", validExtraction, 60);
    await store.set("invalid-key", { ...validExtraction, result: { summary: "missing schema fields" } } as AiPlanExtractProviderResult, 60);

    expect(await store.get("valid-key")).toMatchObject({
      provider: "openai",
      model: "gpt-4o-mini",
    });
    expect(await store.get("invalid-key")).toBeNull();
    expect(entries.has("invalid-key")).toBe(false);
  });

  it("prunes expired memory entries when writing new cache results", async () => {
    const entries = new Map([
      [
        "expired-key",
        {
          value: validExtraction,
          expiresAt: Date.now() - 1_000,
        },
      ],
    ]);
    const store = createMemoryPlanExtractCacheStore(entries);

    await store.set("fresh-key", validExtraction, 60);

    expect(entries.has("expired-key")).toBe(false);
    expect(entries.has("fresh-key")).toBe(true);
  });

  it("does not cache retryable plan-review provider failures", () => {
    expect(shouldCachePlanExtractResult(validExtraction)).toBe(true);
    expect(
      shouldCachePlanExtractResult({
        ...validExtraction,
        review: {
          status: "completed",
          provider: "openrouter",
          model: "google/gemini-2.0-flash-exp:free",
        },
      })
    ).toBe(true);
    expect(
      shouldCachePlanExtractResult({
        ...validExtraction,
        review: {
          status: "unavailable",
          provider: "openrouter",
          model: "google/gemini-2.0-flash-exp:free",
          error: { message: "Provider openrouter respondeu 429.", retryable: true },
        },
      })
    ).toBe(false);
    expect(
      shouldCachePlanExtractResult({
        ...validExtraction,
        review: {
          status: "unavailable",
          provider: "openrouter",
          model: "openai/gpt-4o",
          error: { message: "Modelo pago bloqueado.", code: "ai-paid-model-blocked", retryable: false },
        },
      })
    ).toBe(true);
  });
});
