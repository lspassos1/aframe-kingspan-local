import { describe, expect, it, vi } from "vitest";
import {
  createPlanExtractDiagnosticRecord,
  createRedisPlanExtractDiagnosticStore,
  getPlanExtractFileSizeBucket,
  recordPlanExtractDiagnosticAttempt,
  type PlanExtractDiagnosticAttemptInput,
  type PlanExtractDiagnosticRecord,
  type PlanExtractDiagnosticStore,
} from "@/lib/ai/plan-extract-diagnostics";

const baseAttempt: PlanExtractDiagnosticAttemptInput = {
  diagnosticId: "diag_test_123",
  mode: "free-cloud",
  status: "provider_chain_failed",
  userId: "user_123",
  mimeType: "image/png",
  fileSizeBytes: 2 * 1024 * 1024,
  cache: "MISS",
  reason: "provider-chain-failed",
  providersTried: ["gemini", "openrouter/free"],
  providerErrors: [
    {
      provider: "gemini",
      message: "Gemini failed at https://generativelanguage.googleapis.com/v1 with Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456\n    at /Users/lucas/app.ts:12",
    },
    {
      provider: "openrouter/free",
      message: "OpenRouter respondeu 429 com x-api-key=short-token",
    },
  ],
  durationMs: 1200,
  quota: "released",
  message: "Nao foi possivel extrair em https://example.test com apikey=super-secret",
  env: {
    AI_RATE_LIMIT_SALT: "test-salt",
  },
  now: new Date("2026-05-15T12:00:00.000Z"),
};

function createRecord(): PlanExtractDiagnosticRecord {
  return createPlanExtractDiagnosticRecord(baseAttempt);
}

describe("plan extraction diagnostics", () => {
  it("creates sanitized records without raw files, secrets, URLs or stack traces", () => {
    const record = createRecord();
    const serialized = JSON.stringify(record);

    expect(record).toMatchObject({
      diagnosticId: "diag_test_123",
      createdAt: "2026-05-15T12:00:00.000Z",
      mode: "free-cloud",
      mimeType: "image/png",
      sizeBucket: "1-5MB",
      cache: "MISS",
      status: "provider_chain_failed",
      quota: "released",
      externalStatuses: [429],
    });
    expect(record.user).toMatch(/^user:[a-f0-9]{32}$/);
    expect(serialized).not.toContain("user_123");
    expect(serialized).not.toContain("generativelanguage.googleapis.com");
    expect(serialized).not.toContain("example.test");
    expect(serialized).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(serialized).not.toContain("short-token");
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("/Users/lucas");
    expect(serialized).not.toContain("base64");
  });

  it("buckets uploaded plan sizes without keeping the file content", () => {
    expect(getPlanExtractFileSizeBucket(undefined)).toBe("unknown");
    expect(getPlanExtractFileSizeBucket(512 * 1024)).toBe("<1MB");
    expect(getPlanExtractFileSizeBucket(2 * 1024 * 1024)).toBe("1-5MB");
    expect(getPlanExtractFileSizeBucket(7 * 1024 * 1024)).toBe("5-10MB");
    expect(getPlanExtractFileSizeBucket(12 * 1024 * 1024)).toBe(">10MB");
  });

  it("records successful Pro attempts and Free PDF recovery reasons", () => {
    const paidRecord = createPlanExtractDiagnosticRecord({
      ...baseAttempt,
      diagnosticId: "diag_paid_success",
      mode: "paid",
      status: "success",
      reason: "extraction-success",
      mimeType: "application/pdf",
      providersTried: ["openai"],
      providerErrors: [],
      quota: "consumed",
      message: "Extração concluída. Revise os campos antes de aplicar.",
    });
    const freePdfRecord = createPlanExtractDiagnosticRecord({
      ...baseAttempt,
      diagnosticId: "diag_free_pdf",
      mode: "free-cloud",
      mimeType: "application/pdf",
      reason: "free-pdf-provider-unavailable",
      quota: "released",
      message: "Não consegui ler este PDF agora. Exporte a primeira página como imagem ou continue manualmente.",
    });

    expect(paidRecord).toMatchObject({
      mode: "paid",
      status: "success",
      reason: "extraction-success",
      mimeType: "application/pdf",
      providersTried: ["openai"],
      quota: "consumed",
    });
    expect(freePdfRecord).toMatchObject({
      mode: "free-cloud",
      status: "provider_chain_failed",
      reason: "free-pdf-provider-unavailable",
      mimeType: "application/pdf",
      quota: "released",
    });
  });

  it("writes sanitized diagnostics to Redis-compatible storage with TTL metadata", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(Array.from({ length: 7 }, () => ({ result: "OK" }))), { status: 200 }));
    const store = createRedisPlanExtractDiagnosticStore(
      {
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
        UPSTASH_REDIS_REST_TOKEN: "redis-secret-token",
      },
      fetcher as unknown as typeof fetch
    );

    expect(store?.kind).toBe("redis");
    await store?.save(createRecord());

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://redis.example.test/pipeline");
    expect(init?.method).toBe("POST");
    expect(JSON.stringify(init?.body)).not.toContain("redis-secret-token");
    const commands = JSON.parse(String(init?.body)) as unknown[][];
    expect(commands[0]).toEqual(expect.arrayContaining(["SET", "ai:plan-extract:attempt:diag_test_123", "EX", "604800"]));
    expect(commands.some((command) => command[0] === "EXPIRE" && command.includes("604800"))).toBe(true);
  });

  it("falls back to a sanitized console record when persistent storage fails", async () => {
    const failingStore: PlanExtractDiagnosticStore = {
      kind: "redis",
      save: vi.fn(async () => {
        throw new Error("Redis failed at https://redis.example.test with Bearer abcdefghijklmnopqrstuvwxyz123456");
      }),
    };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    await expect(recordPlanExtractDiagnosticAttempt(baseAttempt, { store: failingStore, logger })).resolves.toMatchObject({
      diagnosticId: "diag_test_123",
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "ai_plan_extract_diagnostic_store_failed",
      expect.objectContaining({
        diagnosticId: "diag_test_123",
        message: expect.not.stringContaining("redis.example.test"),
      })
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(logger.info).toHaveBeenCalledWith("ai_plan_extract_attempt", expect.objectContaining({ diagnosticId: "diag_test_123" }));
  });

  it("falls back when Redis pipeline returns per-command errors with HTTP 200", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([{ result: "OK" }, { error: "WRONGTYPE Operation against a key" }]), { status: 200 }));
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    await expect(
      recordPlanExtractDiagnosticAttempt(baseAttempt, {
        env: {
          UPSTASH_REDIS_REST_URL: "https://redis.example.test",
          UPSTASH_REDIS_REST_TOKEN: "redis-secret-token",
        },
        fetcher: fetcher as unknown as typeof fetch,
        logger,
      })
    ).resolves.toMatchObject({
      diagnosticId: "diag_test_123",
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "ai_plan_extract_diagnostic_store_failed",
      expect.objectContaining({
        diagnosticId: "diag_test_123",
        message: "Diagnostic store command failed.",
      })
    );
    expect(logger.info).toHaveBeenCalledWith("ai_plan_extract_attempt", expect.objectContaining({ diagnosticId: "diag_test_123" }));
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("redis-secret-token");
  });

  it("falls back when Redis pipeline returns an invalid HTTP 200 body", async () => {
    const fetcher = vi.fn(async () => new Response("not-json", { status: 200 }));
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    await expect(
      recordPlanExtractDiagnosticAttempt(baseAttempt, {
        env: {
          UPSTASH_REDIS_REST_URL: "https://redis.example.test",
          UPSTASH_REDIS_REST_TOKEN: "redis-secret-token",
        },
        fetcher: fetcher as unknown as typeof fetch,
        logger,
      })
    ).resolves.toMatchObject({
      diagnosticId: "diag_test_123",
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "ai_plan_extract_diagnostic_store_failed",
      expect.objectContaining({
        diagnosticId: "diag_test_123",
        message: "Diagnostic store returned an invalid pipeline response.",
      })
    );
    expect(logger.info).toHaveBeenCalledWith("ai_plan_extract_attempt", expect.objectContaining({ diagnosticId: "diag_test_123" }));
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("redis-secret-token");
  });

  it("falls back when Redis pipeline returns an empty response list", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    await expect(
      recordPlanExtractDiagnosticAttempt(baseAttempt, {
        env: {
          UPSTASH_REDIS_REST_URL: "https://redis.example.test",
          UPSTASH_REDIS_REST_TOKEN: "redis-secret-token",
        },
        fetcher: fetcher as unknown as typeof fetch,
        logger,
      })
    ).resolves.toMatchObject({
      diagnosticId: "diag_test_123",
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "ai_plan_extract_diagnostic_store_failed",
      expect.objectContaining({
        diagnosticId: "diag_test_123",
        message: "Diagnostic store returned an invalid pipeline response.",
      })
    );
    expect(logger.info).toHaveBeenCalledWith("ai_plan_extract_attempt", expect.objectContaining({ diagnosticId: "diag_test_123" }));
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("redis-secret-token");
  });

  it("does not throw when diagnostic record construction fails", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    await expect(
      recordPlanExtractDiagnosticAttempt(
        {
          ...baseAttempt,
          diagnosticId: null as unknown as string,
        },
        { store: null, logger }
      )
    ).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith(
      "ai_plan_extract_diagnostic_store_failed",
      expect.objectContaining({
        diagnosticId: "",
      })
    );
    expect(logger.info).not.toHaveBeenCalled();
  });
});
