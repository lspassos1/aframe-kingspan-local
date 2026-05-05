import { describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { createOperationalChecklist, type OperationalEnvironmentStatus } from "@/lib/operations/operational-checklist";
import type { PriceSource } from "@/lib/budget-assistant";
import type { Project } from "@/types/project";

vi.mock("server-only", () => ({}));

const disabledEnvironment: OperationalEnvironmentStatus = {
  aiPlanExtractEnabled: false,
  openAiApiKeyConfigured: false,
  openAiModelConfigured: false,
  providerLabel: "OpenAI",
  dailyLimitLabel: "3/usuário · 5/IP · 50/global",
};

function getStatus(items: ReturnType<typeof createOperationalChecklist>, id: string) {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error(`Missing checklist item: ${id}`);
  return item.status;
}

describe("operational checklist", () => {
  it("shows safe fallback statuses when AI and SINAPI are not configured", () => {
    const checklist = createOperationalChecklist(disabledEnvironment, defaultProject);

    expect(getStatus(checklist, "ai")).toBe("desligada");
    expect(getStatus(checklist, "provider")).toBe("OpenAI");
    expect(getStatus(checklist, "model")).toBe("ausente");
    expect(getStatus(checklist, "daily-limit")).toBe("disponível");
    expect(getStatus(checklist, "sinapi")).toBe("base ausente");
    expect(getStatus(checklist, "state")).toBe("definida");
    expect(getStatus(checklist, "reference")).toBe("ausente");
    expect(getStatus(checklist, "regime")).toBe("ausente");
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
        openAiApiKeyConfigured: true,
        openAiModelConfigured: true,
      },
      project
    );

    expect(getStatus(checklist, "ai")).toBe("ativa");
    expect(getStatus(checklist, "sinapi")).toBe("base importada");
    expect(getStatus(checklist, "reference")).toBe("definida");
    expect(getStatus(checklist, "regime")).toBe("definido");
    expect(JSON.stringify(checklist)).not.toContain("sk-");
  });

  it("keeps AI active with OpenAI key while reporting an absent explicit model", () => {
    const checklist = createOperationalChecklist(
      {
        ...disabledEnvironment,
        aiPlanExtractEnabled: true,
        openAiApiKeyConfigured: true,
        openAiModelConfigured: false,
      },
      defaultProject
    );

    expect(getStatus(checklist, "ai")).toBe("ativa");
    expect(getStatus(checklist, "model")).toBe("ausente");
  });

  it("keeps a safe UF status when a legacy project has no scenarios", () => {
    const projectWithoutScenarios: Project = {
      ...defaultProject,
      selectedScenarioId: "missing",
      scenarios: [],
    };
    const checklist = createOperationalChecklist(disabledEnvironment, projectWithoutScenarios);

    expect(getStatus(checklist, "state")).toBe("ausente");
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
