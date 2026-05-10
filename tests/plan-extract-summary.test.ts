import { describe, expect, it } from "vitest";
import { buildDeterministicPlanExtractionSummary, summarizePlanExtractionForReview, type AiTextProviderConfig } from "@/lib/ai/text-providers";
import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";

const planResult: PlanExtractResult = {
  version: "1.0",
  summary: "Planta residencial com leitura parcial.",
  confidence: "medium",
  extracted: {
    projectName: "Residencia teste",
    city: "Curitiba",
    state: "PR",
    builtAreaM2: 92,
    houseWidthM: 8,
    houseDepthM: 11.5,
    doorCount: 4,
    windowCount: 5,
    notes: [],
  },
  fieldConfidence: {
    builtAreaM2: "medium",
    houseWidthM: "low",
    city: "high",
  },
  questions: [
    {
      id: "scale-reference",
      question: "Qual medida real posso usar como referencia?",
      target: "scale",
      requiredBeforeBudget: true,
    },
  ],
  extractionWarnings: [
    {
      code: "multi_model_divergence",
      message: "Divergencia entre providers para houseWidthM.",
      severity: "warning",
      target: "houseWidthM",
    },
  ],
  assumptions: ["Pe-direito preliminar ate revisao."],
  missingInformation: ["Confirmar escala da planta."],
  warnings: [],
};

describe("plan extraction text summary", () => {
  it("uses Groq as the primary text-summary provider without mutating structured data", async () => {
    const before = JSON.stringify(planResult);
    const calledProviders: string[] = [];

    const summary = await summarizePlanExtractionForReview(
      { result: planResult },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_TEXT_PROVIDER: "groq",
          GROQ_API_KEY: "groq-key",
          GROQ_TEXT_MODEL: "llama-3.1-8b-instant",
        },
        async callProvider(config) {
          calledProviders.push(config.id);
          return {
            status: "completed",
            source: "provider",
            provider: config.id,
            model: config.model,
            text: "Revise escala, largura e pendencias antes de aplicar.",
            detected: ["Area construida: 92 m2"],
            lowConfidence: ["houseWidthM"],
            divergences: ["houseWidthM"],
            pendingQuestions: ["Confirmar escala da planta."],
            nextSteps: ["Responder pendencias."],
          };
        },
      }
    );

    expect(calledProviders).toEqual(["groq"]);
    expect(summary).toMatchObject({
      status: "completed",
      source: "provider",
      provider: "groq",
      text: "Revise escala, largura e pendencias antes de aplicar.",
    });
    expect(JSON.stringify(planResult)).toBe(before);
  });

  it("falls back to Cerebras when Groq fails", async () => {
    const calls: string[] = [];

    const summary = await summarizePlanExtractionForReview(
      { result: planResult },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_TEXT_PROVIDER: "groq",
          AI_TEXT_FALLBACK_PROVIDER: "cerebras",
          GROQ_API_KEY: "groq-key",
          CEREBRAS_API_KEY: "cerebras-key",
          CEREBRAS_TEXT_MODEL: "llama3.1-8b",
        },
        async callProvider(config) {
          calls.push(config.id);
          if (config.id === "groq") throw new Error("Groq rate limit.");
          return createProviderSummary(config, "Resumo de fallback Cerebras.");
        },
      }
    );

    expect(calls).toEqual(["groq", "cerebras"]);
    expect(summary).toMatchObject({
      status: "completed",
      source: "provider",
      provider: "cerebras",
      text: "Resumo de fallback Cerebras.",
    });
    expect(summary.providerErrors).toBeUndefined();
  });

  it("uses a deterministic local summary when all text providers fail or are missing", async () => {
    const summary = await summarizePlanExtractionForReview(
      { result: planResult },
      {
        env: {
          AI_MODE: "free-cloud",
          AI_TEXT_PROVIDER: "groq",
          AI_TEXT_FALLBACK_PROVIDER: "cerebras",
        },
      }
    );

    expect(summary.status).toBe("fallback");
    expect(summary.source).toBe("deterministic");
    expect(summary.text).toContain("Detectado:");
    expect(summary.pendingQuestions).toEqual(expect.arrayContaining(["Qual medida real posso usar como referencia?", "Confirmar escala da planta."]));
    expect(summary.providerErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "text-summary", code: "ai-provider-not-configured" }),
        expect.objectContaining({ provider: "text-fallback", code: "ai-provider-not-configured" }),
      ])
    );
  });

  it("surfaces divergences and unresolved comparison items in deterministic summaries", () => {
    const summary = buildDeterministicPlanExtractionSummary({
      result: planResult,
      review: {
        agreements: [],
        divergences: [
          {
            field: "builtAreaM2",
            primaryValue: 92,
            reviewValue: 110,
            pendingReason: "Divergencia multi-modelo em builtAreaM2.",
          },
        ],
        unresolved: [
          {
            field: "houseDepthM",
            primaryValue: 11.5,
            reviewValue: undefined,
            pendingReason: "Segunda leitura nao confirmou houseDepthM.",
          },
        ],
      },
    });

    expect(summary.divergences).toEqual(expect.arrayContaining(["builtAreaM2: segunda leitura sugeriu 110"]));
    expect(summary.pendingQuestions).toEqual(expect.arrayContaining(["houseDepthM: Segunda leitura nao confirmou houseDepthM."]));
    expect(summary.nextSteps).toEqual(expect.arrayContaining(["Responder pendencias antes de gerar orçamento."]));
  });
});

function createProviderSummary(config: AiTextProviderConfig, text: string) {
  return {
    status: "completed" as const,
    source: "provider" as const,
    provider: config.id,
    model: config.model,
    text,
    detected: ["Area construida: 92 m2"],
    lowConfidence: [],
    divergences: [],
    pendingQuestions: [],
    nextSteps: ["Revisar antes de aplicar."],
  };
}
