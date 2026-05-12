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
      providerLabel: "Modo gratuito",
      dailyLimitLabel: "4/usuário · 6/IP · 80/global",
      centralPriceDbConfigured: false,
      centralPriceDbLabel: "não configurada",
      lastMonthlySyncLabel: "sem registro",
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
});
