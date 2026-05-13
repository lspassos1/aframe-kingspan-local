import "server-only";

import { resolveAiMode } from "@/lib/ai/mode";
import type { OperationalEnvironmentStatus } from "@/lib/operations/operational-checklist";
import { createExternalPriceDbOperationalStatus } from "@/lib/pricing/price-db-operations";

function getPositiveNumberEnv(env: Record<string, string | undefined>, key: string, fallback: number) {
  const value = Number(env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function hasEnv(env: Record<string, string | undefined>, key: string) {
  return Boolean(env[key]?.trim());
}

function hasPersistentRateLimitStorage(env: Record<string, string | undefined>) {
  return (hasEnv(env, "UPSTASH_REDIS_REST_URL") && hasEnv(env, "UPSTASH_REDIS_REST_TOKEN")) || (hasEnv(env, "KV_REST_API_URL") && hasEnv(env, "KV_REST_API_TOKEN"));
}

export function createOperationalEnvironmentStatus(env: Record<string, string | undefined> = process.env): OperationalEnvironmentStatus {
  const perUserLimit = getPositiveNumberEnv(env, "AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER", 3);
  const perIpLimit = getPositiveNumberEnv(env, "AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP", 5);
  const globalLimit = getPositiveNumberEnv(env, "AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT", 50);
  const aiMode = resolveAiMode(env);
  const centralPriceDbConfigured = hasEnv(env, "NEXT_PUBLIC_SUPABASE_URL") && hasEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const centralPriceDbOperational = createExternalPriceDbOperationalStatus({
    configured: centralPriceDbConfigured,
  });

  return {
    aiPlanExtractEnabled: env.AI_PLAN_EXTRACT_ENABLED === "true",
    aiMode: aiMode.mode,
    aiProviderConfigured: aiMode.primaryConfigured && aiMode.primaryModelConfigured,
    aiModelConfigured: aiMode.primaryModelConfigured,
    aiRateLimitSaltConfigured: hasEnv(env, "AI_RATE_LIMIT_SALT"),
    aiRateLimitStorageConfigured: hasPersistentRateLimitStorage(env),
    providerLabel: aiMode.publicModeLabel,
    dailyLimitLabel: `${perUserLimit}/usuário · ${perIpLimit}/IP · ${globalLimit}/global`,
    centralPriceDbConfigured,
    centralPriceDbLabel: centralPriceDbOperational.centralLabel,
    lastSemiannualSyncLabel: centralPriceDbOperational.syncLabel,
    centralPriceDbOperational,
  };
}
