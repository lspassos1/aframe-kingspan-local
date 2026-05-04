import { describe, expect, it } from "vitest";
import {
  createMemoryPlanExtractCacheStore,
  createPlanExtractCacheKey,
  getPlanExtractCacheTtlSeconds,
  getPlanExtractCacheVersion,
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
      AI_PLAN_EXTRACT_PROVIDER_ORDER: "openai",
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
});
