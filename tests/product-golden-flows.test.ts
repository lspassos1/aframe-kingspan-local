import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanImportProviderUiStatus } from "@/lib/ai/plan-import-ui";
import {
  createGoldenFlowLocalPriceBaseProject,
  createGoldenFlowNoPriceBaseProject,
  createGoldenFlowReviewRequiredProject,
  productGoldenFlowEnvironments,
} from "./fixtures/product-golden-flows";

vi.mock("server-only", () => ({}));

const clerkState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
}));

const projectStore = vi.hoisted(() => ({
  state: {
    project: undefined as unknown,
    setProject: vi.fn(),
    setOnboardingCompleted: vi.fn(),
  },
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => clerkState,
  UserButton: () => createElement("span", { "data-testid": "user-button" }, "User"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/store/project-store", () => {
  const useProjectStore = Object.assign((selector: (state: typeof projectStore.state) => unknown) => selector(projectStore.state), {
    getState: () => projectStore.state,
  });

  return { useProjectStore };
});

import { PlanImportCard } from "@/components/ai/PlanImportCard";
import { HomeAuthExperience } from "@/components/landing/HomeAuthExperience";
import { StartGuidedAssistant } from "@/components/onboarding/StartGuidedAssistant";
import { GuidedActionPanel } from "@/components/shared/GuidedActionPanel";
import { createBudgetAssistantViewModel } from "@/lib/budget-assistant";
import { getSafePlanImportProviderUiStatus } from "@/lib/ai/plan-import-status";
import { createOperationalChecklist } from "@/lib/operations/operational-checklist";
import { createOperationalEnvironmentStatus } from "@/lib/operations/operational-environment";
import { createBudgetAssistantGuidance, createExportGuidance } from "@/lib/ux/guided-actions";

const forbiddenPublicTerms = [
  "Gemini",
  "OpenRouter",
  "Groq",
  "Cerebras",
  "SambaNova",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "AI_MODE",
  "gpt-",
  "free-cloud router",
  "fallback pago",
  "stack trace",
];

function expectNoPublicProviderLeakage(html: string) {
  for (const term of forbiddenPublicTerms) {
    expect(html).not.toContain(term);
  }
}

function getSelectedViewModel(project: ReturnType<typeof createGoldenFlowNoPriceBaseProject>) {
  const scenario = project.scenarios.find((item) => item.id === project.selectedScenarioId) ?? project.scenarios[0];
  return createBudgetAssistantViewModel(project, scenario);
}

function createBudgetGuidanceFromProject(project: ReturnType<typeof createGoldenFlowNoPriceBaseProject>, remotePriceDbConfigured: boolean) {
  const scenario = project.scenarios.find((item) => item.id === project.selectedScenarioId) ?? project.scenarios[0];
  const viewModel = createBudgetAssistantViewModel(project, scenario);

  return createBudgetAssistantGuidance({
    hasValidRegion: Boolean(scenario.location.city && scenario.location.state),
    costSourceCount: viewModel.costSources.length,
    applicableCostSourceCount: viewModel.applicableCostSources.length,
    pendingPriceCount: viewModel.unpricedCount,
    lowConfidenceCount: viewModel.lowConfidenceCount,
    remotePriceDbConfigured,
  });
}

describe("golden product flows", () => {
  beforeEach(() => {
    clerkState.isLoaded = true;
    clerkState.isSignedIn = false;
    projectStore.state.project = createGoldenFlowNoPriceBaseProject();
  });

  it("renders landing, start and upload review entry points with product language only", () => {
    const freeStatus: PlanImportProviderUiStatus = getSafePlanImportProviderUiStatus(productGoldenFlowEnvironments.freeModeNoRemoteDb);
    const landingHtml = renderToStaticMarkup(createElement(HomeAuthExperience));
    const startHtml = renderToStaticMarkup(createElement(StartGuidedAssistant, { planExtractEnabled: true, initialMode: "ai", aiProviderStatus: freeStatus }));
    const uploadHtml = renderToStaticMarkup(createElement(PlanImportCard, { planExtractEnabled: true, aiProviderStatus: freeStatus }));
    const html = [landingHtml, startHtml, uploadHtml].join(" ");

    expect(html).toContain("Enviar planta");
    expect(html).toContain("Revisão da planta");
    expect(html).toContain("Dados extraídos");
    expect(html).toContain("orçamento preliminar");
    expect(html).toContain("Exportação");
    expect(html).toContain("Modo gratuito");
    expect(html).toContain("Análise");
    expect(html).toContain("Revisao detalhada");
    expect(html).toContain("Continuar manualmente disponível");
    expect(html).toContain("Sem cobrança automática");
    expectNoPublicProviderLeakage(html);
  });

  it("keeps the product usable when AI and the remote price DB are unavailable", () => {
    const project = createGoldenFlowNoPriceBaseProject();
    const environment = createOperationalEnvironmentStatus(productGoldenFlowEnvironments.noAiNoRemoteDb);
    const checklist = createOperationalChecklist(environment, project);
    const guidance = createBudgetGuidanceFromProject(project, environment.centralPriceDbConfigured);
    const guidanceHtml = renderToStaticMarkup(createElement(GuidedActionPanel, { items: guidance }));
    const publicChecklistDetails = checklist.map((item) => `${item.label} ${item.status} ${item.detail}`).join(" ");

    expect(checklist.find((item) => item.id === "plan-extract")?.status).toBe("desligado");
    expect(checklist.find((item) => item.id === "manual-fallback")?.status).toBe("disponível");
    expect(checklist.find((item) => item.id === "central-db")?.status).toBe("não configurada");
    expect(guidance.map((item) => item.id)).toEqual(expect.arrayContaining(["central-db-unavailable", "no-price-base", "pending-prices"]));
    expect(guidance.every((item) => item.actions.length > 0)).toBe(true);
    expect(guidanceHtml).toContain("Importar base de preços");
    expect(guidanceHtml).toContain("Preencher preço");
    expect(guidanceHtml).toContain("Cadastrar fonte");
    expect(guidanceHtml).not.toContain("Buscar na base central");
    expect(publicChecklistDetails).not.toContain("API_KEY");
    expect(publicChecklistDetails).not.toContain("service role");
  });

  it("covers local imported price data, missing prices and review-required budget lines", () => {
    const noPriceProject = createGoldenFlowNoPriceBaseProject();
    const localProject = createGoldenFlowLocalPriceBaseProject();
    const reviewProject = createGoldenFlowReviewRequiredProject();
    const noPriceViewModel = getSelectedViewModel(noPriceProject);
    const localViewModel = getSelectedViewModel(localProject);
    const reviewViewModel = getSelectedViewModel(reviewProject);
    const reviewGuidance = createBudgetGuidanceFromProject(reviewProject, false);
    const exportGuidance = createExportGuidance({
      pendingMaterialCount: 1,
      pendingBudgetItemCount: reviewViewModel.unpricedCount,
      warningCount: 1,
    });

    expect(noPriceViewModel.costSources).toHaveLength(0);
    expect(noPriceViewModel.unpricedCount).toBeGreaterThan(0);
    expect(localViewModel.costSources).toHaveLength(1);
    expect(localViewModel.applicableCostSources).toHaveLength(1);
    expect(localViewModel.unpricedCount).toBe(noPriceViewModel.unpricedCount - 1);
    expect(reviewViewModel.lowConfidenceCount).toBe(1);
    expect(reviewGuidance.map((item) => item.title)).toContain("Preço pendente de revisão");
    expect(reviewGuidance.flatMap((item) => item.actions.map((action) => action.label))).toEqual(expect.arrayContaining(["Revisar fonte", "Preencher preço"]));
    expect(exportGuidance.flatMap((item) => item.actions.map((action) => action.href))).toEqual(
      expect.arrayContaining(["/budget-assistant", "/materials", "/technical-project"])
    );
  });

  it("tracks screenshot evidence for the required desktop and mobile smoke routes", () => {
    const manifest = readFileSync("docs/design-audit/screenshots/pr204/README.md", "utf8");

    expect(manifest).toContain("/");
    expect(manifest).toContain("/start");
    expect(manifest).toContain("/budget-assistant");
    expect(manifest).toContain("/help");
    expect(manifest).toContain("upload/review");
    expect(manifest).toContain("desktop");
    expect(manifest).toContain("mobile");
    expect(manifest).toContain("docs/design-audit/screenshots/pr199/199-home-desktop.png");
    expect(manifest).toContain("docs/design-audit/screenshots/pr205/205-budget-assistant-empty-mobile.png");
  });
});
