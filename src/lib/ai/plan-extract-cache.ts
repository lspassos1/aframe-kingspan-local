import { createHash } from "node:crypto";
import {
  getAiPlanExtractProviderConfigs,
  getAiPlanReviewProviderConfig,
  type AiPlanExtractEnv,
  type AiPlanExtractMimeType,
  type AiPlanExtractProviderResult,
} from "@/lib/ai/providers";
import { readAiProductMode } from "@/lib/ai/mode";
import { planExtractResultSchema } from "@/lib/ai/plan-extract-schema";
import { hasActionablePlanExtractFields } from "@/lib/ai/apply-plan-extract";

export type AiPlanExtractCacheStore = {
  kind: "memory";
  get(key: string): Promise<AiPlanExtractProviderResult | null>;
  set(key: string, value: AiPlanExtractProviderResult, ttlSeconds: number): Promise<void>;
};

type MemoryCacheEntry = {
  expiresAt: number;
  value: AiPlanExtractProviderResult;
};

const sharedMemoryCache = new Map<string, MemoryCacheEntry>();

function pruneExpiredEntries(entries: Map<string, MemoryCacheEntry>, now: number) {
  for (const [key, entry] of entries.entries()) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
}

function hashValue(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function createReviewErrorVersion(error: unknown, env: AiPlanExtractEnv) {
  const message = error instanceof Error ? error.message : "unknown";
  return {
    id: "review-unavailable",
    requestedProvider: env.AI_PLAN_REVIEW_PROVIDER ?? null,
    requestedModel: env.OPENROUTER_PLAN_REVIEW_MODEL ?? null,
    configured: false,
    errorName: error instanceof Error ? error.name : "Error",
    errorHash: hashValue(message).slice(0, 16),
  };
}

function getNumberEnv(env: AiPlanExtractEnv, key: string, fallback: number) {
  const value = Number(env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getPlanExtractCacheTtlSeconds(env: AiPlanExtractEnv = process.env) {
  return getNumberEnv(env, "AI_PLAN_EXTRACT_CACHE_TTL_HOURS", 24) * 60 * 60;
}

export function getPlanExtractCacheVersion(env: AiPlanExtractEnv = process.env) {
  if (env.AI_PLAN_EXTRACT_CACHE_VERSION?.trim()) return env.AI_PLAN_EXTRACT_CACHE_VERSION.trim();

  const providers = getAiPlanExtractProviderConfigs(env).map((provider) => ({
    id: provider.id,
    model: provider.model,
    baseUrl: provider.baseUrl,
    configured: provider.configured,
    supports: provider.supports,
  }));
  let reviewVersion: Record<string, unknown> | null = null;
  try {
    const reviewProvider = getAiPlanReviewProviderConfig(env);
    if (reviewProvider) {
      reviewVersion = {
        id: reviewProvider.id,
        model: reviewProvider.model,
        baseUrl: reviewProvider.baseUrl,
        configured: reviewProvider.configured,
        supports: reviewProvider.supports,
      };
    }
  } catch (error) {
    reviewVersion = createReviewErrorVersion(error, env);
  }

  return hashValue(JSON.stringify({ schema: "1.0-advanced-v2", prompt: "plan-extract-advanced-v2", providers, reviewVersion })).slice(0, 24);
}

export function shouldCachePlanExtractResult(value: AiPlanExtractProviderResult) {
  return hasActionablePlanExtractFields(value.result) && (value.review?.status !== "unavailable" || value.review.error?.retryable !== true);
}

export function createPlanExtractCacheKey({
  fileBytes,
  mimeType,
  env = process.env,
}: {
  fileBytes: Uint8Array;
  mimeType: AiPlanExtractMimeType;
  env?: AiPlanExtractEnv;
}) {
  const fileHash = hashValue(fileBytes);
  const versionHash = hashValue(getPlanExtractCacheVersion(env)).slice(0, 24);
  const mimeToken = mimeType.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const modeToken = readAiProductMode(env);

  return {
    key: `ai:plan-extract-cache:${modeToken}:${mimeToken}:${versionHash}:${fileHash}`,
    fileHash,
    versionHash,
  };
}

export function createMemoryPlanExtractCacheStore(entries = sharedMemoryCache): AiPlanExtractCacheStore {
  return {
    kind: "memory",
    async get(key) {
      const now = Date.now();
      const entry = entries.get(key);
      if (!entry || entry.expiresAt <= now) {
        entries.delete(key);
        return null;
      }

      const parsed = planExtractResultSchema.safeParse(entry.value.result);
      if (!parsed.success || !hasActionablePlanExtractFields(parsed.data)) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      const now = Date.now();
      pruneExpiredEntries(entries, now);
      entries.set(key, {
        value,
        expiresAt: now + ttlSeconds * 1000,
      });
    },
  };
}
