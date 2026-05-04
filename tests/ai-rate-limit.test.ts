import { describe, expect, it } from "vitest";
import { checkAndConsumeAiDailyLimit, createAiRateLimitHeaders, createMemoryAiRateLimitStore, getClientIpFromHeaders } from "@/lib/ai/rate-limit";

const baseEnv = {
  NODE_ENV: "development",
  AI_RATE_LIMIT_SALT: "test-salt",
  AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER: "3",
  AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP: "5",
  AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT: "50",
};

describe("AI daily rate limit", () => {
  it("blocks the fourth user request in the same day", async () => {
    const store = createMemoryAiRateLimitStore(new Map());
    const input = {
      feature: "plan-extract" as const,
      userId: "user-1",
      ip: "203.0.113.10",
      now: new Date("2026-05-04T12:00:00.000Z"),
    };

    const first = await checkAndConsumeAiDailyLimit(input, { env: baseEnv, store });
    await checkAndConsumeAiDailyLimit(input, { env: baseEnv, store });
    const third = await checkAndConsumeAiDailyLimit(input, { env: baseEnv, store });
    const fourth = await checkAndConsumeAiDailyLimit(input, { env: baseEnv, store });

    expect(first.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    expect(fourth).toMatchObject({
      allowed: false,
      scope: "user",
      reason: "user-daily-limit-exceeded",
    });
  });

  it("blocks the sixth IP request for anonymous usage when enabled", async () => {
    const store = createMemoryAiRateLimitStore(new Map());
    const env = { ...baseEnv, AI_ALLOW_ANONYMOUS_PLAN_EXTRACT: "true" };
    const input = {
      feature: "plan-extract" as const,
      userId: null,
      ip: "203.0.113.11",
      now: new Date("2026-05-04T12:00:00.000Z"),
    };

    for (let index = 0; index < 5; index += 1) {
      const decision = await checkAndConsumeAiDailyLimit(input, { env, store });
      expect(decision.allowed).toBe(true);
    }
    const blocked = await checkAndConsumeAiDailyLimit(input, { env, store });

    expect(blocked).toMatchObject({
      allowed: false,
      scope: "ip",
      reason: "ip-daily-limit-exceeded",
    });
  });

  it("resets limits when the UTC date changes", async () => {
    const store = createMemoryAiRateLimitStore(new Map());
    const dayOne = {
      feature: "plan-extract" as const,
      userId: "user-2",
      ip: "203.0.113.12",
      now: new Date("2026-05-04T23:59:00.000Z"),
    };
    const dayTwo = { ...dayOne, now: new Date("2026-05-05T00:01:00.000Z") };

    await checkAndConsumeAiDailyLimit(dayOne, { env: baseEnv, store });
    await checkAndConsumeAiDailyLimit(dayOne, { env: baseEnv, store });
    await checkAndConsumeAiDailyLimit(dayOne, { env: baseEnv, store });
    const blocked = await checkAndConsumeAiDailyLimit(dayOne, { env: baseEnv, store });
    const reset = await checkAndConsumeAiDailyLimit(dayTwo, { env: baseEnv, store });

    expect(blocked.allowed).toBe(false);
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(2);
  });

  it("denies anonymous usage by default before consuming quota", async () => {
    const decision = await checkAndConsumeAiDailyLimit(
      {
        feature: "plan-extract",
        userId: null,
        ip: "203.0.113.13",
        now: new Date("2026-05-04T12:00:00.000Z"),
      },
      { env: baseEnv, store: createMemoryAiRateLimitStore(new Map()) }
    );

    expect(decision).toMatchObject({
      allowed: false,
      scope: "user",
      reason: "anonymous-not-allowed",
    });
  });

  it("extracts client IP and builds response headers", async () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.14, 10.0.0.1",
    });
    const decision = await checkAndConsumeAiDailyLimit(
      {
        feature: "plan-extract",
        userId: "user-3",
        ip: getClientIpFromHeaders(headers),
        now: new Date("2026-05-04T12:00:00.000Z"),
      },
      { env: baseEnv, store: createMemoryAiRateLimitStore(new Map()) }
    );

    expect(getClientIpFromHeaders(headers)).toBe("203.0.113.14");
    expect(createAiRateLimitHeaders(decision)).toMatchObject({
      "X-RateLimit-Limit": "3",
      "X-RateLimit-Remaining": "2",
      "X-RateLimit-Scope": "user",
    });
  });
});
