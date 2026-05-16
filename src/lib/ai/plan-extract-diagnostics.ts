import { createHash, randomUUID } from "node:crypto";
import { sanitizeAiDiagnosticMessage } from "@/lib/ai/safe-errors";
import type { AiProductMode } from "@/lib/ai/mode";

export type PlanExtractDiagnosticCacheStatus = "HIT" | "MISS" | "SKIP";
export type PlanExtractDiagnosticQuotaStatus = "not-consumed" | "consumed" | "released";
export type PlanExtractDiagnosticStatus = "success" | "provider_chain_failed" | "extraction_empty" | "rate_limit" | "setup_unavailable" | "invalid_file";

export type PlanExtractDiagnosticEnv = Record<string, string | undefined>;

export type PlanExtractDiagnosticProviderError = {
  provider: string;
  message: string;
  status?: number;
};

export type PlanExtractProviderAttemptDiagnostic = {
  provider: string;
  attempt: number;
  outcome: "success" | "failed";
  durationMs?: number;
  status?: number;
  retryReason?: string;
};

export type PlanExtractImageProcessingDiagnostic = {
  status: "processed" | "unchanged" | "skipped" | "failed";
  reason: "within-limits" | "large-image" | "heavy-png" | "large-image-heavy-png" | "processed-not-smaller" | "metadata-unavailable" | "non-image" | "preprocess-error";
  originalSizeBucket: string;
  processedSizeBucket: string;
  originalDimensions?: { width: number; height: number };
  processedDimensions?: { width: number; height: number };
  originalFormat: string;
  processedFormat: string;
};

export type PlanExtractDiagnosticAttemptInput = {
  diagnosticId: string;
  mode: AiProductMode;
  status: PlanExtractDiagnosticStatus;
  userId?: string | null;
  mimeType?: string;
  fileSizeBytes?: number;
  cache: PlanExtractDiagnosticCacheStatus;
  reason?: string;
  providersTried?: string[];
  providerErrors?: PlanExtractDiagnosticProviderError[];
  durationMs?: number;
  providerDurations?: Array<{ provider: string; durationMs: number }>;
  providerAttempts?: PlanExtractProviderAttemptDiagnostic[];
  imageProcessing?: PlanExtractImageProcessingDiagnostic;
  quota: PlanExtractDiagnosticQuotaStatus;
  message?: string;
  env?: PlanExtractDiagnosticEnv;
  now?: Date;
};

export type PlanExtractDiagnosticRecord = {
  diagnosticId: string;
  createdAt: string;
  expiresInSeconds: number;
  user: string;
  mode: AiProductMode;
  mimeType: string;
  sizeBucket: string;
  cache: PlanExtractDiagnosticCacheStatus;
  status: PlanExtractDiagnosticStatus;
  reason: string;
  providersTried: string[];
  providerErrors: PlanExtractDiagnosticProviderError[];
  externalStatuses: number[];
  durationMs?: number;
  providerDurations: Array<{ provider: string; durationMs: number }>;
  providerAttempts: PlanExtractProviderAttemptDiagnostic[];
  imageProcessing?: PlanExtractImageProcessingDiagnostic;
  quota: PlanExtractDiagnosticQuotaStatus;
  message: string;
};

export type PlanExtractDiagnosticStore = {
  kind: "redis" | "console";
  save(record: PlanExtractDiagnosticRecord): Promise<void>;
};

const diagnosticTtlSeconds = 60 * 60 * 24 * 7;
const recentAttemptsLimit = 100;

function getDiagnosticSalt(env: PlanExtractDiagnosticEnv) {
  return env.AI_RATE_LIMIT_SALT?.trim() || "plan-extract-diagnostics";
}

function hashValue(value: string, salt: string) {
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

function normalizeDiagnosticToken(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

function sanitizeDiagnosticText(value: string | undefined) {
  return sanitizeAiDiagnosticMessage(String(value ?? "").replace(/\n\s*at\s+.*$/gim, "").trim()).slice(0, 500);
}

function extractHttpStatus(message: string) {
  const match = message.match(/\b([1-5]\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

function normalizePositiveInteger(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value as number)) : undefined;
}

export function createPlanExtractDiagnosticId() {
  return `diag_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function getPlanExtractDiagnosticTtlSeconds() {
  return diagnosticTtlSeconds;
}

export function getPlanExtractFileSizeBucket(bytes: number | undefined) {
  if (!Number.isFinite(bytes) || !bytes || bytes <= 0) return "unknown";
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 1) return "<1MB";
  if (megabytes <= 5) return "1-5MB";
  if (megabytes <= 10) return "5-10MB";
  return ">10MB";
}

export function createPlanExtractDiagnosticRecord(input: PlanExtractDiagnosticAttemptInput): PlanExtractDiagnosticRecord {
  const env = input.env ?? process.env;
  const user = input.userId ? `user:${hashValue(input.userId, getDiagnosticSalt(env))}` : "anonymous";
  const providerErrors = (input.providerErrors ?? []).map((error) => {
    const message = sanitizeDiagnosticText(error.message);
    return {
      provider: normalizeDiagnosticToken(error.provider),
      message,
      status: error.status ?? extractHttpStatus(message),
    };
  });
  const externalStatuses = Array.from(new Set(providerErrors.map((error) => error.status).filter((status): status is number => Number.isFinite(status))));

  return {
    diagnosticId: normalizeDiagnosticToken(input.diagnosticId),
    createdAt: (input.now ?? new Date()).toISOString(),
    expiresInSeconds: diagnosticTtlSeconds,
    user,
    mode: input.mode,
    mimeType: input.mimeType?.trim() || "unknown",
    sizeBucket: getPlanExtractFileSizeBucket(input.fileSizeBytes),
    cache: input.cache,
    status: input.status,
    reason: normalizeDiagnosticToken(input.reason ?? input.status),
    providersTried: Array.from(new Set((input.providersTried ?? providerErrors.map((error) => error.provider)).map(normalizeDiagnosticToken).filter(Boolean))),
    providerErrors,
    externalStatuses,
    durationMs: normalizePositiveInteger(input.durationMs),
    providerDurations: (input.providerDurations ?? []).map((duration) => ({
      provider: normalizeDiagnosticToken(duration.provider),
      durationMs: Math.max(0, Math.round(duration.durationMs)),
    })),
    providerAttempts: (input.providerAttempts ?? []).map((attempt) => {
      const durationMs = normalizePositiveInteger(attempt.durationMs);
      const status = normalizePositiveInteger(attempt.status);
      const retryReason = normalizeDiagnosticToken(attempt.retryReason ?? "");
      return {
        provider: normalizeDiagnosticToken(attempt.provider),
        attempt: Math.max(1, Math.round(attempt.attempt)),
        outcome: attempt.outcome === "success" ? "success" : "failed",
        ...(durationMs === undefined ? {} : { durationMs }),
        ...(status === undefined ? {} : { status }),
        ...(retryReason ? { retryReason } : {}),
      };
    }),
    imageProcessing: input.imageProcessing
      ? {
          status: input.imageProcessing.status,
          reason: input.imageProcessing.reason,
          originalSizeBucket: input.imageProcessing.originalSizeBucket,
          processedSizeBucket: input.imageProcessing.processedSizeBucket,
          originalDimensions: input.imageProcessing.originalDimensions,
          processedDimensions: input.imageProcessing.processedDimensions,
          originalFormat: normalizeDiagnosticToken(input.imageProcessing.originalFormat) || "unknown",
          processedFormat: normalizeDiagnosticToken(input.imageProcessing.processedFormat) || "unknown",
        }
      : undefined,
    quota: input.quota,
    message: sanitizeDiagnosticText(input.message),
  };
}

function getRedisConfig(env: PlanExtractDiagnosticEnv) {
  const upstashUrl = env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const kvUrl = env.KV_REST_API_URL?.trim();
  const kvToken = env.KV_REST_API_TOKEN?.trim();
  const url = upstashUrl && upstashToken ? upstashUrl : kvUrl && kvToken ? kvUrl : "";
  const token = upstashUrl && upstashToken ? upstashToken : kvUrl && kvToken ? kvToken : "";
  if (!url || !token) return null;
  return {
    endpoint: url.replace(/\/$/, ""),
    token,
    timeoutMs: 2500,
  };
}

export function hasPlanExtractDiagnosticStorage(env: PlanExtractDiagnosticEnv = process.env) {
  return Boolean(getRedisConfig(env));
}

export function createConsolePlanExtractDiagnosticStore(logger: Pick<typeof console, "info"> = console): PlanExtractDiagnosticStore {
  return {
    kind: "console",
    async save(record) {
      logger.info("ai_plan_extract_attempt", record);
    },
  };
}

export function createRedisPlanExtractDiagnosticStore(env: PlanExtractDiagnosticEnv = process.env, fetcher: typeof fetch = fetch): PlanExtractDiagnosticStore | null {
  const config = getRedisConfig(env);
  if (!config) return null;

  return {
    kind: "redis",
    async save(record) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      const attemptKey = `ai:plan-extract:attempt:${record.diagnosticId}`;
      const recentKey = "ai:plan-extract:attempts:recent";
      const dateKey = record.createdAt.slice(0, 10);
      const userKey = `ai:plan-extract:attempts:user:${record.user}:${dateKey}`;
      const commands = [
        ["SET", attemptKey, JSON.stringify(record), "EX", String(diagnosticTtlSeconds)],
        ["LPUSH", recentKey, record.diagnosticId],
        ["LTRIM", recentKey, "0", String(recentAttemptsLimit - 1)],
        ["EXPIRE", recentKey, String(diagnosticTtlSeconds)],
        ["LPUSH", userKey, record.diagnosticId],
        ["LTRIM", userKey, "0", String(recentAttemptsLimit - 1)],
        ["EXPIRE", userKey, String(diagnosticTtlSeconds)],
      ];

      try {
        const response = await fetcher(`${config.endpoint}/pipeline`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(commands),
        });
        if (!response.ok) throw new Error(`Diagnostic store failed with ${response.status}.`);
        const payload = await response.json().catch(() => null);
        if (!Array.isArray(payload) || payload.length === 0) throw new Error("Diagnostic store returned an invalid pipeline response.");
        if (hasRedisPipelineError(payload)) throw new Error("Diagnostic store command failed.");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function hasRedisPipelineError(payload: unknown[]) {
  return payload.some((item) => {
    if (!item || typeof item !== "object") return false;
    const error = (item as { error?: unknown }).error;
    return typeof error === "string" ? error.trim().length > 0 : Boolean(error);
  });
}

export async function recordPlanExtractDiagnosticAttempt(
  input: PlanExtractDiagnosticAttemptInput,
  options: {
    store?: PlanExtractDiagnosticStore | null;
    env?: PlanExtractDiagnosticEnv;
    fetcher?: typeof fetch;
    logger?: Pick<typeof console, "info" | "warn">;
  } = {}
) {
  const env = options.env ?? input.env ?? process.env;
  const logger = options.logger ?? console;
  let record: PlanExtractDiagnosticRecord | undefined;

  try {
    record = createPlanExtractDiagnosticRecord({ ...input, env });
    const store = options.store === undefined ? createRedisPlanExtractDiagnosticStore(env, options.fetcher) : options.store;
    const fallbackStore = createConsolePlanExtractDiagnosticStore(logger);

    await (store ?? fallbackStore).save(record);
    return record;
  } catch (error) {
    logger.warn("ai_plan_extract_diagnostic_store_failed", {
      diagnosticId: normalizeDiagnosticToken(String(input.diagnosticId ?? "")),
      message: sanitizeDiagnosticText(error instanceof Error ? error.message : String(error)),
    });
  }

  try {
    const fallbackRecord = record ?? createPlanExtractDiagnosticRecord({ ...input, env });
    await createConsolePlanExtractDiagnosticStore(logger).save(fallbackRecord);
    return fallbackRecord;
  } catch {
    return null;
  }
}
