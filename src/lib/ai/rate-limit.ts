import { createHash } from "node:crypto";

export type AiRateLimitScope = "user" | "ip" | "global";
export type AiRateLimitStorageKind = "redis" | "memory";

export type AiRateLimitDecision = {
  allowed: boolean;
  scope: AiRateLimitScope;
  limit: number;
  remaining: number;
  resetAt: string;
  storage: AiRateLimitStorageKind;
  reason?: string;
  consumedKeys?: string[];
};

export type AiRateLimitInput = {
  feature: "plan-extract";
  userId?: string | null;
  ip?: string | null;
  now?: Date;
};

export type AiRateLimitEnv = Record<string, string | undefined>;

export type AiRateLimitStore = {
  kind: AiRateLimitStorageKind;
  increment(key: string, ttlSeconds: number): Promise<number>;
  decrement(key: string): Promise<void>;
};

type MemoryEntry = {
  count: number;
  expiresAt: number;
};

const sharedMemoryStore = new Map<string, MemoryEntry>();

function getNumberEnv(env: AiRateLimitEnv, key: string, fallback: number) {
  const value = Number(env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getBooleanEnv(env: AiRateLimitEnv, key: string, fallback = false) {
  const value = env[key];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

export function createMemoryAiRateLimitStore(entries = sharedMemoryStore): AiRateLimitStore {
  return {
    kind: "memory",
    async increment(key, ttlSeconds) {
      const now = Date.now();
      const current = entries.get(key);
      if (!current || current.expiresAt <= now) {
        entries.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
        return 1;
      }
      current.count += 1;
      return current.count;
    },
    async decrement(key) {
      const now = Date.now();
      const current = entries.get(key);
      if (!current || current.expiresAt <= now) return;
      current.count = Math.max(0, current.count - 1);
    },
  };
}

export function createRedisAiRateLimitStore(env: AiRateLimitEnv = process.env, fetcher: typeof fetch = fetch): AiRateLimitStore | null {
  const upstashUrl = env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const kvUrl = env.KV_REST_API_URL?.trim();
  const kvToken = env.KV_REST_API_TOKEN?.trim();
  const [redisUrl, redisToken] = upstashUrl && upstashToken ? [upstashUrl, upstashToken] : kvUrl && kvToken ? [kvUrl, kvToken] : [undefined, undefined];
  if (!redisUrl || !redisToken) return null;
  const redisEndpointBase: string = redisUrl;
  const redisAuthorizationToken: string = redisToken;
  const timeoutMs = getNumberEnv(env, "AI_RATE_LIMIT_REDIS_TIMEOUT_MS", 2500);

  async function fetchRedis(path: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetcher(path, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${redisAuthorizationToken}` },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function decrementRedis(key: string) {
    const endpoint = redisEndpointBase.replace(/\/$/, "");
    const response = await fetchRedis(`${endpoint}/decr/${encodeURIComponent(key)}`);
    if (!response.ok) throw new Error(`Redis DECR failed with ${response.status}.`);
  }

  return {
    kind: "redis",
    async increment(key, ttlSeconds) {
      const endpoint = redisEndpointBase.replace(/\/$/, "");
      const incrementResponse = await fetchRedis(`${endpoint}/incr/${encodeURIComponent(key)}`);
      if (!incrementResponse.ok) throw new Error(`Redis INCR failed with ${incrementResponse.status}.`);
      const incrementPayload = (await incrementResponse.json()) as { result?: number };
      const count = Number(incrementPayload.result);
      if (!Number.isFinite(count)) throw new Error("Redis INCR returned an invalid count.");

      if (count === 1) {
        try {
          const expireResponse = await fetchRedis(`${endpoint}/expire/${encodeURIComponent(key)}/${ttlSeconds}`);
          if (!expireResponse.ok) throw new Error(`Redis EXPIRE failed with ${expireResponse.status}.`);
        } catch (error) {
          await decrementRedis(key).catch(() => undefined);
          throw error;
        }
      }

      return count;
    },
    async decrement(key) {
      await decrementRedis(key);
    },
  };
}

function getDateKey(now: Date) {
  return now.toISOString().slice(0, 10);
}

function getResetAt(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function getTtlSeconds(now: Date, resetAt: Date) {
  return Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
}

function hashIdentifier(value: string, salt: string) {
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 40);
}

function buildDailyKey(input: { feature: "plan-extract"; scope: AiRateLimitScope; identifier: string; dateKey: string; salt: string }) {
  return `ai:${input.feature}:${input.scope}:${input.dateKey}:${hashIdentifier(input.identifier, input.salt)}`;
}

function buildHeadersDecision(decision: AiRateLimitDecision) {
  return decision;
}

export function getClientIpFromHeaders(headers: Headers, options: { trustProxyHeaders?: boolean } = {}) {
  if (!options.trustProxyHeaders) return null;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
}

export function createAiRateLimitHeaders(decision: AiRateLimitDecision) {
  return {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": decision.resetAt,
    "X-RateLimit-Scope": decision.scope,
  };
}

export function isAiDailyLimitReason(reason: string | undefined) {
  return Boolean(reason?.endsWith("-daily-limit-exceeded"));
}

export function isAiRateLimitSetupReason(reason: string | undefined) {
  return reason === "rate-limit-salt-required" || reason === "rate-limit-storage-unavailable" || reason === "rate-limit-store-error";
}

export async function releaseAiDailyLimitDecision(decision: AiRateLimitDecision, store: AiRateLimitStore | null = createRedisAiRateLimitStore()) {
  if (!decision.allowed || !store || decision.consumedKeys?.length === 0) return;
  await Promise.allSettled((decision.consumedKeys ?? []).map((key) => store.decrement(key)));
}

export async function checkAndConsumeAiDailyLimit(
  input: AiRateLimitInput,
  options: {
    env?: AiRateLimitEnv;
    store?: AiRateLimitStore | null;
    fetcher?: typeof fetch;
  } = {}
): Promise<AiRateLimitDecision> {
  const env = options.env ?? process.env;
  const now = input.now ?? new Date();
  const resetAtDate = getResetAt(now);
  const resetAt = resetAtDate.toISOString();
  const ttlSeconds = getTtlSeconds(now, resetAtDate);
  const salt = env.AI_RATE_LIMIT_SALT?.trim() || "change-me-in-production";
  const allowAnonymous = getBooleanEnv(env, "AI_ALLOW_ANONYMOUS_PLAN_EXTRACT", false);
  const failOpen = env.NODE_ENV !== "production" && getBooleanEnv(env, "AI_RATE_LIMIT_FAIL_OPEN", false);
  const limits = {
    global: getNumberEnv(env, "AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT", 50),
    user: getNumberEnv(env, "AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER", 3),
    ip: getNumberEnv(env, "AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP", 5),
  };

  const redisStore = options.store === undefined ? createRedisAiRateLimitStore(env, options.fetcher) : null;
  const store = options.store ?? redisStore ?? (env.NODE_ENV === "production" ? null : createMemoryAiRateLimitStore());

  if (env.NODE_ENV === "production" && salt === "change-me-in-production") {
    return buildHeadersDecision({
      allowed: false,
      scope: "global",
      limit: limits.global,
      remaining: 0,
      resetAt,
      storage: store?.kind ?? "memory",
      reason: "rate-limit-salt-required",
    });
  }

  if (!input.userId && !allowAnonymous) {
    return buildHeadersDecision({
      allowed: false,
      scope: "user",
      limit: limits.user,
      remaining: 0,
      resetAt,
      storage: store?.kind ?? "memory",
      reason: "anonymous-not-allowed",
    });
  }

  if (!store) {
    return buildHeadersDecision({
      allowed: false,
      scope: "global",
      limit: limits.global,
      remaining: 0,
      resetAt,
      storage: "memory",
      reason: "rate-limit-storage-unavailable",
    });
  }
  const activeStore = store;

  const scopes: Array<{ scope: AiRateLimitScope; identifier: string; limit: number }> = [
    ...(input.userId ? [{ scope: "user" as const, identifier: input.userId, limit: limits.user }] : []),
    ...(input.ip ? [{ scope: "ip" as const, identifier: input.ip, limit: limits.ip }] : []),
    { scope: "global", identifier: "global", limit: limits.global },
  ];
  const consumed: Array<{ key: string; scope: AiRateLimitScope; limit: number; count: number; remaining: number }> = [];
  const scopeKeys = scopes.map((scope) => ({
    ...scope,
    key: buildDailyKey({
      feature: input.feature,
      scope: scope.scope,
      identifier: scope.identifier,
      dateKey: getDateKey(now),
      salt,
    }),
  }));

  async function rollbackConsumedScopes() {
    await Promise.allSettled(consumed.map((scope) => activeStore.decrement(scope.key)));
  }

  for (const scope of scopeKeys) {
    let count: number;
    try {
      count = await activeStore.increment(scope.key, ttlSeconds);
    } catch (error) {
      await rollbackConsumedScopes();
      if (failOpen) {
        return buildHeadersDecision({
          allowed: true,
          scope: scope.scope,
          limit: scope.limit,
          remaining: scope.limit,
          resetAt,
          storage: activeStore.kind,
          reason: `rate-limit-store-error-fail-open:${error instanceof Error ? error.message : "unknown"}`,
        });
      }
      return buildHeadersDecision({
        allowed: false,
        scope: scope.scope,
        limit: scope.limit,
        remaining: 0,
        resetAt,
        storage: activeStore.kind,
        reason: "rate-limit-store-error",
      });
    }
    if (count > scope.limit) {
      await Promise.allSettled([activeStore.decrement(scope.key), rollbackConsumedScopes()]);
      return buildHeadersDecision({
        allowed: false,
        scope: scope.scope,
        limit: scope.limit,
        remaining: 0,
        resetAt,
        storage: activeStore.kind,
        reason: `${scope.scope}-daily-limit-exceeded`,
      });
    }
    consumed.push({
      key: scope.key,
      scope: scope.scope,
      limit: scope.limit,
      count,
      remaining: Math.max(0, scope.limit - count),
    });
  }

  const tightestScope = consumed.reduce<{ scope: AiRateLimitScope; limit: number; remaining: number } | null>((current, scope) => {
    if (!current || scope.remaining < current.remaining) return scope;
    return current;
  }, null);

  return buildHeadersDecision({
    allowed: true,
    scope: tightestScope?.scope ?? "global",
    limit: tightestScope?.limit ?? limits.global,
    remaining: tightestScope?.remaining ?? limits.global,
    resetAt,
    storage: activeStore.kind,
    consumedKeys: consumed.map((scope) => scope.key),
  });
}
