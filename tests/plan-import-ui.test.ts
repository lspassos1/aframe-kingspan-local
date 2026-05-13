import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { getSafePlanImportProviderUiStatus } from "@/lib/ai/plan-import-status";
import {
  canUsePlanImportUpload,
  formatPlanImportProviderName,
  getPlanImportPayloadMessage,
  getPlanImportStateCopy,
  getPlanImportStateFromResponse,
  planImportStateCopy,
  type PlanImportProviderUiStatus,
} from "@/lib/ai/plan-import-ui";

const projectStore = vi.hoisted(() => ({
  state: {
    project: undefined as unknown,
    setProject: vi.fn(),
  },
}));

vi.mock("@/lib/store/project-store", () => {
  const useProjectStore = Object.assign((selector: (state: typeof projectStore.state) => unknown) => selector(projectStore.state), {
    getState: () => projectStore.state,
  });

  return { useProjectStore };
});

import { PlanImportCard } from "@/components/ai/PlanImportCard";

const freeCloudStatus: PlanImportProviderUiStatus = {
  mode: "free-cloud",
  modeLabel: "Modo gratuito",
  primaryProviderLabel: "Análise rápida",
  reviewProviderLabel: "Revisão detalhada",
  textProviderLabel: "Resumo de pendências",
  textFallbackProviderLabel: "Resumo alternativo",
  paidFallbackEnabled: false,
  primaryConfigured: true,
  reviewConfigured: false,
};

describe("plan import UI state", () => {
  it("classifies cache hit, review ready, limit and error responses", () => {
    expect(getPlanImportStateFromResponse({ ok: true, status: 200, cacheHeader: "HIT" })).toBe("cache-hit");
    expect(getPlanImportStateFromResponse({ ok: true, status: 200, cached: true })).toBe("cache-hit");
    expect(getPlanImportStateFromResponse({ ok: true, status: 200 })).toBe("review-ready");
    expect(getPlanImportStateFromResponse({ ok: false, status: 429 })).toBe("limit-exceeded");
    expect(getPlanImportStateFromResponse({ ok: false, status: 415 })).toBe("error");
  });

  it("keeps explicit copy for upload, analyzing, cache hit and limit states", () => {
    expect(planImportStateCopy.idle.title).toContain("Arraste");
    expect(planImportStateCopy.uploading.badge).toBe("Enviando");
    expect(planImportStateCopy.analyzing.title).toContain("Modo Pro");
    expect(planImportStateCopy["cache-hit"].description).toContain("limite diário não foi consumido");
    expect(planImportStateCopy["limit-exceeded"].title).toContain("Envio por IA indisponível hoje");
    expect(planImportStateCopy["limit-exceeded"].description).toContain("Continue manualmente");
  });

  it("switches upload copy to free-cloud mode without promising a paid provider", () => {
    expect(getPlanImportStateCopy("idle", freeCloudStatus).badge).toBe("Modo gratuito");
    expect(getPlanImportStateCopy("analyzing", freeCloudStatus).title).toContain("Análise rápida");
    expect(getPlanImportStateCopy("analyzing", freeCloudStatus).description).toContain("Revisão detalhada");
    expect(getPlanImportStateCopy("limit-exceeded", freeCloudStatus).title).toContain("Envio por IA indisponível hoje");
    expect(getPlanImportStateCopy("limit-exceeded", freeCloudStatus).description).toContain("Continue manualmente");
  });

  it("uses safe API messages without exposing provider secrets", () => {
    expect(getPlanImportPayloadMessage({ message: "Modo Pro de IA nao esta configurado no servidor." }, "error")).toContain("Modo Pro");
    expect(getPlanImportPayloadMessage(null, "limit-exceeded")).toContain("Envio por IA").not.toContain("indisponível hoje");
    expect(getPlanImportPayloadMessage(null, "limit-exceeded")).toBe("Continue manualmente ou tente novamente amanhã.");
  });

  it("blocks upload activation while the daily limit fallback is active", () => {
    expect(canUsePlanImportUpload({ planExtractEnabled: true, state: "idle" })).toBe(true);
    expect(canUsePlanImportUpload({ planExtractEnabled: true, state: "limit-exceeded" })).toBe(false);
    expect(canUsePlanImportUpload({ planExtractEnabled: false, state: "idle" })).toBe(false);
  });

  it("formats provider responses as product modes", () => {
    expect(formatPlanImportProviderName("custom-free-provider")).toBe("Modo gratuito");
    expect(formatPlanImportProviderName("openai")).toBe("Modo Pro");
  });

  it("creates safe free-cloud UI status from server env without leaking keys", () => {
    const status = getSafePlanImportProviderUiStatus({
      AI_MODE: "free-cloud",
      AI_PLAN_PRIMARY_PROVIDER: "gemini",
      AI_PLAN_REVIEW_PROVIDER: "openrouter",
      AI_TEXT_PROVIDER: "groq",
      AI_TEXT_FALLBACK_PROVIDER: "cerebras",
      AI_PAID_FALLBACK_ENABLED: "false",
      GEMINI_API_KEY: "secret-gemini",
      GEMINI_MODEL: "gemini-2.5-flash",
      OPENROUTER_API_KEY: "secret-openrouter",
      GROQ_API_KEY: "secret-groq",
    });

    expect(status).toMatchObject({
      mode: "free-cloud",
      modeLabel: "Modo gratuito",
      primaryProviderLabel: "Análise rápida",
      reviewProviderLabel: "Revisão detalhada",
      textProviderLabel: "Resumo de pendencias",
      paidFallbackEnabled: false,
      primaryConfigured: true,
      reviewConfigured: true,
    });
    expect(JSON.stringify(status)).not.toContain("secret-");
  });
});

describe("PlanImportCard", () => {
  beforeEach(() => {
    projectStore.state.project = defaultProject;
  });

  it("renders a dropzone as the primary upload action", () => {
    const html = renderToStaticMarkup(createElement(PlanImportCard, { planExtractEnabled: true }));

    expect(html).toContain('data-state="idle"');
    expect(html).toContain("Arraste a planta aqui");
    expect(html).toContain("Clique para selecionar ou solte o arquivo aqui");
    expect(html).toContain("Modo Pro aguardando configuração no servidor.");
  });

  it("renders free-cloud provider status, comparison and manual fallback copy", () => {
    const html = renderToStaticMarkup(createElement(PlanImportCard, { planExtractEnabled: true, aiProviderStatus: freeCloudStatus }));

    expect(html).toContain("Modo gratuito");
    expect(html).toContain("Análise rápida sugere campos preliminares");
    expect(html).toContain("Modo gratuito: Análise rápida.");
    expect(html).toContain("Revisão: Revisão detalhada aguardando configuração no servidor.");
    expect(html).toContain("Sem cobrança automática");
    expect(html).not.toContain("OPENAI_API_KEY");
    expect(html).not.toContain("Gemini");
    expect(html).not.toContain("OpenRouter");
    expect(html).not.toContain("fallback pago");
  });

  it("keeps paid fallback disabled even if the env flag is misconfigured", () => {
    const status = getSafePlanImportProviderUiStatus({
      AI_MODE: "free-cloud",
      AI_PLAN_PRIMARY_PROVIDER: "gemini",
      AI_PAID_FALLBACK_ENABLED: "true",
      GEMINI_API_KEY: "secret-gemini",
    });

    expect(status.paidFallbackEnabled).toBe(false);
  });

  it("does not advertise paid fallback in free-cloud upload status", () => {
    const html = renderToStaticMarkup(
      createElement(PlanImportCard, {
        planExtractEnabled: true,
        aiProviderStatus: freeCloudStatus,
      })
    );

    expect(html).toContain("Modo gratuito");
    expect(html).toContain("Análise rápida sugere campos preliminares");
    expect(html).toContain("Sem cobrança automática");
    expect(html).not.toContain("provider pago");
    expect(html).not.toContain("fallback pago");
  });

  it("renders operational setup copy when AI extraction is disabled", () => {
    const html = renderToStaticMarkup(createElement(PlanImportCard, { planExtractEnabled: false }));

    expect(html).toContain("Upload assistido indisponível");
    expect(html).toContain("Configure o Modo Pro no servidor.");
    expect(html).toContain("Configure o Modo Pro no servidor ou continue manualmente.");
    expect(html).toContain("Continuar manualmente");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain("Clique para selecionar ou solte o arquivo aqui");
  });

  it("renders daily limit fallback without active upload instructions or technical terms", () => {
    const html = renderToStaticMarkup(
      createElement(PlanImportCard, {
        planExtractEnabled: true,
        aiProviderStatus: freeCloudStatus,
        initialState: "limit-exceeded",
      })
    );

    expect(html).toContain('data-state="limit-exceeded"');
    expect(html).toContain("Envio por IA indisponível hoje");
    expect(html).toContain("Continue manualmente ou tente novamente amanhã");
    expect(html).toContain("Continuar manualmente");
    expect(html).toContain("Tentar novamente depois");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain("Clique para selecionar ou solte o arquivo aqui");
    expect(html).not.toContain("Gemini");
    expect(html).not.toContain("OpenRouter");
    expect(html).not.toContain("OPENAI_API_KEY");
    expect(html).not.toContain("router");
    expect(html).not.toContain("fallback pago");
  });

  it("does not duplicate the daily limit fallback sentence across the limit UI", () => {
    const html = renderToStaticMarkup(
      createElement(PlanImportCard, {
        planExtractEnabled: true,
        aiProviderStatus: freeCloudStatus,
        initialState: "limit-exceeded",
      })
    );

    expect(html.match(/Continue manualmente ou tente novamente amanhã/g)).toHaveLength(1);
    expect(html).not.toContain("Continue manualmente ou tente novamente amanha");
    expect(html).not.toContain("Envio por IA indisponivel hoje");
  });

  it("renders free-cloud setup copy when extraction is disabled", () => {
    const html = renderToStaticMarkup(createElement(PlanImportCard, { planExtractEnabled: false, aiProviderStatus: freeCloudStatus }));

    expect(html).toContain("Configure o modo gratuito no servidor.");
    expect(html).toContain("Configure o modo gratuito no servidor ou continue manualmente.");
    expect(html).toContain("Continuar manualmente");
    expect(html).not.toContain("OPENAI_API_KEY");
  });
});
