import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createOperationalEnvironmentStatus } from "@/lib/operations/operational-environment";

describe("operational environment status", () => {
  it("returns only safe free-cloud configuration metadata", () => {
    const status = createOperationalEnvironmentStatus({
      AI_PLAN_EXTRACT_ENABLED: "true",
      AI_MODE: "free-cloud",
      GEMINI_API_KEY: "secret-gemini",
      GEMINI_MODEL: "gemini-2.5-flash",
      AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER: "4",
      AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP: "6",
      AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT: "80",
    });

    expect(status).toEqual({
      aiPlanExtractEnabled: true,
      aiMode: "free-cloud",
      aiProviderConfigured: true,
      aiModelConfigured: true,
      aiRateLimitSaltConfigured: false,
      aiRateLimitStorageConfigured: false,
      aiDiagnosticsStorageConfigured: false,
      providerLabel: "Modo gratuito",
      dailyLimitLabel: "4/usuário · 6/IP · 80/global",
      centralPriceDbConfigured: false,
      centralPriceDbLabel: "não configurada",
      lastSemiannualSyncLabel: "sem configuração",
      centralPriceDbOperational: {
        configured: false,
        status: "missing-config",
        centralLabel: "não configurada",
        syncLabel: "sem configuração",
        detail: "Base central não é dependência: use importação local ou fonte manual revisável.",
        syncDetail: "Configure leitura pública antes de tratar a atualização semestral como disponível.",
        technicalDetail: "Runtime sem configuração pública de leitura. Chave de serviço não pertence ao app.",
        tone: "muted",
        stale: false,
        lastReferenceMonth: "",
      },
    });
    expect(JSON.stringify(status)).not.toContain("secret-gemini");
  });

  it("returns only safe paid OpenAI configuration metadata", () => {
    const status = createOperationalEnvironmentStatus({
      AI_PLAN_EXTRACT_ENABLED: "true",
      AI_MODE: "paid",
      OPENAI_API_KEY: "sk-secret-value",
      AI_OPENAI_MODEL: "gpt-4o-mini",
    });

    expect(status).toMatchObject({
      aiPlanExtractEnabled: true,
      aiMode: "paid",
      aiProviderConfigured: true,
      aiModelConfigured: true,
      aiRateLimitSaltConfigured: false,
      aiRateLimitStorageConfigured: false,
      providerLabel: "Modo Pro",
    });
    expect(JSON.stringify(status)).not.toContain("sk-secret-value");
  });

  it("reports central price DB readiness without exposing public read values", () => {
    const status = createOperationalEnvironmentStatus({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-read-key",
    });

    expect(status.centralPriceDbConfigured).toBe(true);
    expect(status.centralPriceDbLabel).toBe("configurada");
    expect(status.lastSemiannualSyncLabel).toBe("sem registro");
    expect(status.centralPriceDbOperational.status).toBe("missing-sync");
    expect(JSON.stringify(status)).not.toContain("supabase.co");
    expect(JSON.stringify(status)).not.toContain("anon-public-read-key");
  });

  it("falls back to defaults when limits are invalid or non-positive", () => {
    const defaultStatus = createOperationalEnvironmentStatus({});
    const status = createOperationalEnvironmentStatus({
      AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER: "0",
      AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP: "-1",
      AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT: "abc",
    });

    expect(status.dailyLimitLabel).toBe(defaultStatus.dailyLimitLabel);
  });

  it("reports rate-limit salt and persistent storage readiness without exposing values", () => {
    const status = createOperationalEnvironmentStatus({
      AI_RATE_LIMIT_SALT: "super-secret-salt",
      KV_REST_API_URL: "https://safe-example.upstash.io",
      KV_REST_API_TOKEN: "super-secret-token",
    });

    expect(status.aiRateLimitSaltConfigured).toBe(true);
    expect(status.aiRateLimitStorageConfigured).toBe(true);
    expect(status.aiDiagnosticsStorageConfigured).toBe(true);
    expect(JSON.stringify(status)).not.toContain("super-secret");
    expect(JSON.stringify(status)).not.toContain("upstash.io");
  });

  it("keeps UPSTASH Redis env vars compatible for rate-limit storage readiness", () => {
    const status = createOperationalEnvironmentStatus({
      AI_RATE_LIMIT_SALT: "super-secret-salt",
      UPSTASH_REDIS_REST_URL: "https://safe-example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "super-secret-token",
    });

    expect(status.aiRateLimitSaltConfigured).toBe(true);
    expect(status.aiRateLimitStorageConfigured).toBe(true);
    expect(status.aiDiagnosticsStorageConfigured).toBe(true);
    expect(JSON.stringify(status)).not.toContain("super-secret");
    expect(JSON.stringify(status)).not.toContain("upstash.io");
  });
});
