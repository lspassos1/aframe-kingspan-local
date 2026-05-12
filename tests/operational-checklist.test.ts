import { describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { createOperationalChecklist, type OperationalEnvironmentStatus } from "@/lib/operations/operational-checklist";
import type { PriceSource } from "@/lib/budget-assistant";
import type { Project } from "@/types/project";

vi.mock("server-only", () => ({}));

const disabledEnvironment: OperationalEnvironmentStatus = {
  aiPlanExtractEnabled: false,
  aiMode: "free-cloud",
  aiProviderConfigured: false,
  aiModelConfigured: false,
  providerLabel: "Modo gratuito",
  dailyLimitLabel: "3/usuário · 5/IP · 50/global",
  centralPriceDbConfigured: false,
  centralPriceDbLabel: "não configurada",
  lastMonthlySyncLabel: "sem registro",
};

function getStatus(items: ReturnType<typeof createOperationalChecklist>, id: string) {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error(`Missing checklist item: ${id}`);
  return item.status;
}

describe("operational checklist", () => {
  it("shows safe fallback statuses when AI and SINAPI are not configured", () => {
    const checklist = createOperationalChecklist(disabledEnvironment, defaultProject);
    const publicDetails = checklist.map((item) => item.detail).join(" ");

    expect(getStatus(checklist, "ai")).toBe("Modo gratuito");
    expect(getStatus(checklist, "plan-extract")).toBe("desligado");
    expect(getStatus(checklist, "manual-fallback")).toBe("disponível");
    expect(getStatus(checklist, "ai-config")).toBe("ausente");
    expect(getStatus(checklist, "daily-limit")).toBe("disponível");
    expect(getStatus(checklist, "local-price-base")).toBe("ausente");
    expect(getStatus(checklist, "central-db")).toBe("não configurada");
    expect(getStatus(checklist, "sinapi")).toBe("base ausente");
    expect(getStatus(checklist, "state")).toBe("definida");
    expect(getStatus(checklist, "reference")).toBe("ausente");
    expect(getStatus(checklist, "monthly-sync")).toBe("sem registro");
    expect(getStatus(checklist, "export")).toBe("preliminar");
    expect(getStatus(checklist, "regime")).toBe("ausente");
    expect(publicDetails).not.toContain("OPENAI_API_KEY");
    expect(publicDetails).not.toContain("GEMINI_API_KEY");
    expect(publicDetails).not.toContain("AI_MODE");
    expect(checklist.some((item) => item.technicalDetail?.includes("GEMINI_MODEL"))).toBe(true);
  });

  it("detects imported SINAPI metadata without exposing secrets", () => {
    const sinapiSource: PriceSource = {
      id: "sinapi-ba-2026-05",
      type: "sinapi",
      title: "SINAPI BA 2026-05 desonerado",
      supplier: "CAIXA",
      state: "BA",
      city: "",
      referenceDate: "2026-05-01",
      reliability: "high",
      notes: "Regime desonerado importado de arquivo oficial.",
    };
    const project = {
      ...defaultProject,
      budgetAssistant: {
        ...defaultProject.budgetAssistant,
        priceSources: [sinapiSource],
      },
    };
    const checklist = createOperationalChecklist(
      {
        ...disabledEnvironment,
        aiPlanExtractEnabled: true,
        aiProviderConfigured: true,
        aiModelConfigured: true,
      },
      project
    );

    expect(getStatus(checklist, "plan-extract")).toBe("ativo");
    expect(getStatus(checklist, "sinapi")).toBe("base importada");
    expect(getStatus(checklist, "local-price-base")).toBe("1 fonte(s)");
    expect(getStatus(checklist, "reference")).toBe("2026-05");
    expect(getStatus(checklist, "regime")).toBe("definido");
    expect(JSON.stringify(checklist)).not.toContain("sk-");
  });

  it("keeps AI active with configured provider while reporting an absent explicit model", () => {
    const checklist = createOperationalChecklist(
      {
        ...disabledEnvironment,
        aiPlanExtractEnabled: true,
        aiProviderConfigured: true,
        aiModelConfigured: false,
      },
      defaultProject
    );

    expect(getStatus(checklist, "plan-extract")).toBe("ativo");
    expect(getStatus(checklist, "ai-config")).toBe("ausente");
  });

  it("reports central DB as optional and keeps local fallback available when remote DB is absent", () => {
    const checklist = createOperationalChecklist(disabledEnvironment, defaultProject);

    expect(getStatus(checklist, "central-db")).toBe("não configurada");
    expect(getStatus(checklist, "manual-fallback")).toBe("disponível");
    expect(checklist.find((item) => item.id === "central-db")?.detail).toContain("Base central não é dependência");
  });

  it("keeps a safe UF status when a legacy project has no scenarios", () => {
    const projectWithoutScenarios: Project = {
      ...defaultProject,
      selectedScenarioId: "missing",
      scenarios: [],
    };
    const checklist = createOperationalChecklist(disabledEnvironment, projectWithoutScenarios);

    expect(getStatus(checklist, "state")).toBe("ausente");
    expect(getStatus(checklist, "export")).toBe("sem cenário");
  });

  it("keeps a safe UF status when legacy location state is null", () => {
    const projectWithNullState = {
      ...defaultProject,
      scenarios: [
        {
          ...defaultProject.scenarios[0],
          location: {
            ...defaultProject.scenarios[0].location,
            state: null,
          },
        },
      ],
    } as unknown as Project;
    const checklist = createOperationalChecklist(disabledEnvironment, projectWithNullState);

    expect(getStatus(checklist, "state")).toBe("ausente");
  });
});
