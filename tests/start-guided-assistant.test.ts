import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createStartAssistantViewModel, normalizeStartAssistantModeParam } from "@/lib/onboarding/start-guided-assistant";

const planImportCardProps = vi.hoisted(() => ({
  latest: undefined as { onManualFallback?: () => void } | undefined,
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
  PlanImportCard: (props: { onManualFallback?: () => void }) => {
    planImportCardProps.latest = props;
    return createElement("div", { "data-testid": "plan-import" }, "Enviar planta baixa");
  },
}));

vi.mock("@/components/onboarding/StartProjectForm", () => ({
  StartProjectForm: () => createElement("div", { "data-testid": "manual-form" }, "Método construtivo"),
}));

import { StartGuidedAssistant } from "@/components/onboarding/StartGuidedAssistant";

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

  it("renders upload with operational status and a manual fallback in AI mode", () => {
    planImportCardProps.latest = undefined;
    const html = renderToStaticMarkup(createElement(StartGuidedAssistant, { planExtractEnabled: true, initialMode: "ai" }));

    expect(html).toContain('data-testid="plan-import"');
    expect(html).not.toContain('data-testid="manual-form"');
    expect(typeof planImportCardProps.latest?.onManualFallback).toBe("function");
    expect(html).toContain("Status da IA");
    expect(html).toContain("OpenAI API");
    expect(html).toContain("Limite diário");
    expect(html).toContain("Cache por hash ativo");
    expect(html).toContain("Fallback manual disponível");
    expect(html).toContain("Abrir preenchimento manual");
  });

  it("renders the manual fallback when AI mode is selected but disabled", () => {
    const html = renderToStaticMarkup(createElement(StartGuidedAssistant, { planExtractEnabled: false, initialMode: "ai" }));

    expect(html).toContain("A leitura por IA está desligada");
    expect(html).toContain('data-testid="plan-import"');
    expect(html).not.toContain('data-testid="manual-form"');
    expect(html).toContain("Abrir preenchimento manual");
  });
});
