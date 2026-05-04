import { createHash } from "node:crypto";
import { getAiPlanExtractProviderConfigs, type AiPlanExtractEnv, type AiPlanExtractMimeType, type AiPlanExtractProviderResult } from "@/lib/ai/providers";
import { planExtractResultSchema } from "@/lib/ai/plan-extract-schema";

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

function hashValue(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
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

  return hashValue(JSON.stringify({ schema: "1.0", prompt: "plan-extract-v1", providers })).slice(0, 24);
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

  return {
    key: `ai:plan-extract-cache:${mimeToken}:${versionHash}:${fileHash}`,
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
      return parsed.success ? entry.value : null;
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    },
  };
}
