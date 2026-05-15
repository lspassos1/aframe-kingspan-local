import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlanImportProviderUiStatus } from "@/lib/ai/plan-import-ui";
import { createStartAiStatusPills, createStartAssistantViewModel, normalizeStartAssistantModeParam } from "@/lib/onboarding/start-guided-assistant";

const planImportCardProps = vi.hoisted(() => ({
  latest: undefined as { onManualFallback?: () => void; aiProviderStatus?: unknown } | undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/store/project-store", () => ({
  useProjectStore: (selector: (state: { setProject: () => void; setOnboardingCompleted: () => void }) => unknown) =>
    selector({
      setProject: vi.fn(),
      setOnboardingCompleted: vi.fn(),
    }),
}));

vi.mock("@/components/ai/PlanImportCard", () => ({
  PlanImportCard: (props: { onManualFallback?: () => void; aiProviderStatus?: unknown }) => {
    planImportCardProps.latest = props;
    return createElement("div", { "data-testid": "plan-import" }, "Enviar planta baixa");
  },
}));

vi.mock("@/components/onboarding/StartProjectForm", () => ({
  StartProjectForm: () => createElement("div", { "data-testid": "manual-form" }, "Método construtivo"),
}));

import { StartGuidedAssistant } from "@/components/onboarding/StartGuidedAssistant";

const freeCloudStatus: PlanImportProviderUiStatus = {
  mode: "free-cloud",
  modeLabel: "Modo gratuito",
  primaryProviderLabel: "Análise rápida",
  reviewProviderLabel: "Revisão detalhada",
  textProviderLabel: "Resumo de pendências",
  textFallbackProviderLabel: "Resumo alternativo",
  paidFallbackEnabled: false,
  primaryConfigured: true,
  reviewConfigured: true,
};

describe("createStartAssistantViewModel", () => {
  it("normalizes optional start mode query params", () => {
    expect(normalizeStartAssistantModeParam("ai")).toBe("ai");
    expect(normalizeStartAssistantModeParam(["manual", "ai"])).toBe("manual");
    expect(normalizeStartAssistantModeParam("unknown")).toBe("choose");
    expect(normalizeStartAssistantModeParam(undefined)).toBe("choose");
  });

  it("keeps the first layer focused on the three entry modes", () => {
    const viewModel = createStartAssistantViewModel({ mode: "choose", planExtractEnabled: true });

    expect(viewModel.title).toBe("Comece pela planta baixa.");
    expect(viewModel.subtitle).toContain("IA sugere, sistema calcula e você aprova");
    expect(viewModel.options.map((option) => option.id)).toEqual(["ai", "manual", "example"]);
    expect(viewModel.options.map((option) => option.title)).toEqual(["Enviar planta", "Preencher manualmente", "Usar exemplo"]);
    expect(viewModel.showPlanImport).toBe(false);
    expect(viewModel.showManualForm).toBe(false);
  });

  it("makes upload primary in AI mode when extraction is enabled", () => {
    const viewModel = createStartAssistantViewModel({ mode: "ai", planExtractEnabled: true });

    expect(viewModel.showPlanImport).toBe(true);
    expect(viewModel.showManualForm).toBe(false);
    expect(viewModel.showAiDisabledNotice).toBe(false);
    expect(viewModel.options.find((option) => option.id === "ai")?.primary).toBe(true);
  });

  it("falls back to manual flow when AI extraction is disabled", () => {
    const viewModel = createStartAssistantViewModel({ mode: "ai", planExtractEnabled: false });

    expect(viewModel.showPlanImport).toBe(true);
    expect(viewModel.showManualForm).toBe(false);
    expect(viewModel.showAiDisabledNotice).toBe(true);
    expect(viewModel.options.find((option) => option.id === "ai")?.disabledReason).toBe("IA desligada");
  });

  it("describes the AI option as free-cloud when requested", () => {
    const viewModel = createStartAssistantViewModel({ mode: "choose", planExtractEnabled: true, aiMode: "free-cloud" });

    expect(viewModel.options.find((option) => option.id === "ai")?.description).toContain("Análise rápida");
  });

  it("supports manual and example modes explicitly", () => {
    expect(createStartAssistantViewModel({ mode: "manual", planExtractEnabled: true })).toMatchObject({
      showPlanImport: false,
      showManualForm: true,
      shouldRunExample: false,
    });
    expect(createStartAssistantViewModel({ mode: "example", planExtractEnabled: true })).toMatchObject({
      shouldRunExample: true,
    });
  });

  it("separates normal upload availability from the latest runtime failure status", () => {
    expect(
      createStartAiStatusPills({
        planExtractEnabled: true,
        state: "idle",
        aiProviderStatus: freeCloudStatus,
      }).map((item) => item.label)
    ).toEqual(["Upload habilitado", "Cache por hash ativo quando houver resultado", "Análise gratuita depende de limites externos", "Continuar manualmente disponível"]);

    expect(
      createStartAiStatusPills({
        planExtractEnabled: true,
        state: "error",
        aiProviderStatus: freeCloudStatus,
      }).map((item) => item.label)
    ).toEqual(["Análise não concluída", "Continuar manualmente disponível", "Tente outro arquivo quando possível"]);
  });

  it("uses distinct product status for limit, temporary outage and successful review states", () => {
    expect(createStartAiStatusPills({ planExtractEnabled: true, state: "limit-exceeded", aiProviderStatus: freeCloudStatus }).map((item) => item.label)).toEqual([
      "Limite diário atingido",
      "Continuar manualmente disponível",
      "Tente novamente amanhã",
    ]);
    expect(createStartAiStatusPills({ planExtractEnabled: true, state: "temporarily-unavailable", aiProviderStatus: freeCloudStatus }).map((item) => item.label)).toEqual([
      "Upload assistido temporariamente indisponível",
      "Continuar manualmente disponível",
    ]);
    expect(createStartAiStatusPills({ planExtractEnabled: true, state: "review-ready", aiProviderStatus: freeCloudStatus }).map((item) => item.label)).toEqual([
      "Análise pronta para revisão",
      "Revisão humana obrigatória",
      "Continuar manualmente disponível",
    ]);
    expect(createStartAiStatusPills({ planExtractEnabled: true, state: "cache-hit", aiProviderStatus: freeCloudStatus }).map((item) => item.label)).toEqual([
      "Resultado recuperado do cache",
      "Revisão humana obrigatória",
      "Continuar manualmente disponível",
    ]);
    expect(createStartAiStatusPills({ planExtractEnabled: true, state: "applied", aiProviderStatus: freeCloudStatus }).map((item) => item.label)).toEqual([
      "Campos aplicados",
      "Revisar medidas antes de seguir",
      "Continuar manualmente disponível",
    ]);
  });
});

describe("StartGuidedAssistant", () => {
  it("renders the initial screen without construction method content", () => {
    const html = renderToStaticMarkup(createElement(StartGuidedAssistant, { planExtractEnabled: true }));

    expect(html).toContain("Comece pela planta baixa.");
    expect(html).toContain("Enviar planta");
    expect(html).toContain("Preencher manualmente");
    expect(html).toContain("Usar exemplo");
    expect(html).toContain("IA sugere, sistema calcula e você aprova");
    expect(html).toContain("O que acontece depois");
    expect(html).toContain("A confirmação técnica vem depois.");
    expect(html).not.toContain('data-slot="step-progress"');
    expect(html).not.toContain("Método construtivo");
    expect(html).not.toContain("método construtivo");
    expect(html).not.toContain("Escolha o sistema construtivo");
  });

  it("explains why a protected route redirected to start", () => {
    const html = renderToStaticMarkup(
      createElement(StartGuidedAssistant, {
        planExtractEnabled: true,
        redirectReason: "project-required",
        redirectNext: "/dashboard",
      })
    );

    expect(html).toContain("Você tentou abrir /dashboard sem um estudo carregado");
    expect(html).toContain("Comece pela planta, preencha manualmente ou use o exemplo.");
  });

  it("renders upload with operational status and a manual fallback in AI mode", () => {
    planImportCardProps.latest = undefined;
    const html = renderToStaticMarkup(createElement(StartGuidedAssistant, { planExtractEnabled: true, initialMode: "ai" }));

    expect(html).toContain('data-testid="plan-import"');
    expect(html).not.toContain('data-testid="manual-form"');
    expect(typeof planImportCardProps.latest?.onManualFallback).toBe("function");
    expect(html).toContain("Status da IA");
    expect(html).toContain("Modo Pro");
    expect(html).toContain("Limite diário");
    expect(html).toContain("Cache por hash ativo");
    expect(html).toContain("Continuar manualmente disponível");
    expect(html).toContain("Abrir preenchimento manual");
  });

  it("renders free-cloud status without exposing provider keys", () => {
    planImportCardProps.latest = undefined;
    const html = renderToStaticMarkup(createElement(StartGuidedAssistant, { planExtractEnabled: true, initialMode: "ai", aiProviderStatus: freeCloudStatus }));

    expect(html).toContain("Modo gratuito");
    expect(html).toContain("Análise");
    expect(html).toContain("Análise rápida");
    expect(html).toContain("Revisão detalhada quando disponível");
    expect(html).toContain("Análise gratuita depende de limites externos");
    expect(planImportCardProps.latest?.aiProviderStatus).toMatchObject({ mode: "free-cloud", primaryProviderLabel: "Análise rápida" });
    expect(html).not.toContain("OPENAI_API_KEY");
    expect(html).not.toContain("Gemini");
    expect(html).not.toContain("OpenRouter");
    expect(html).not.toContain("Free cloud");
    expect(html).not.toContain("fallback pago");
  });

  it("renders the manual fallback when AI mode is selected but disabled", () => {
    const html = renderToStaticMarkup(createElement(StartGuidedAssistant, { planExtractEnabled: false, initialMode: "ai" }));

    expect(html).toContain("A leitura por IA está desligada");
    expect(html).toContain('data-testid="plan-import"');
    expect(html).not.toContain('data-testid="manual-form"');
    expect(html).toContain("Abrir preenchimento manual");
  });
});
