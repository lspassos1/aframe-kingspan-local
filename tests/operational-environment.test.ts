import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createOperationalEnvironmentStatus } from "@/lib/operations/operational-environment";

describe("operational environment status", () => {
  it("returns only safe OpenAI configuration metadata", () => {
    const status = createOperationalEnvironmentStatus({
      AI_PLAN_EXTRACT_ENABLED: "true",
      OPENAI_API_KEY: "sk-secret-value",
      AI_OPENAI_MODEL: "gpt-4o-mini",
      AI_PLAN_EXTRACT_DAILY_LIMIT_PER_USER: "4",
      AI_PLAN_EXTRACT_DAILY_LIMIT_PER_IP: "6",
      AI_PLAN_EXTRACT_GLOBAL_DAILY_LIMIT: "80",
    });

    expect(status).toEqual({
      aiPlanExtractEnabled: true,
      openAiApiKeyConfigured: true,
      openAiModelConfigured: true,
      providerLabel: "OpenAI",
      dailyLimitLabel: "4/usuário · 6/IP · 80/global",
    });
    expect(JSON.stringify(status)).not.toContain("sk-secret-value");
  });
});
