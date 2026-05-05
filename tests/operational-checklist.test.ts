import { describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { createOperationalChecklist, type OperationalEnvironmentStatus } from "@/lib/operations/operational-checklist";
import type { PriceSource } from "@/lib/budget-assistant";

vi.mock("server-only", () => ({}));

const disabledEnvironment: OperationalEnvironmentStatus = {
  aiPlanExtractEnabled: false,
  openAiApiKeyConfigured: false,
  openAiModelConfigured: false,
  providerLabel: "OpenAI",
  dailyLimitLabel: "3/usuário · 5/IP · 50/global",
};

function getStatus(items: ReturnType<typeof createOperationalChecklist>, label: string) {
  const item = items.find((entry) => entry.label === label);
  if (!item) throw new Error(`Missing checklist item: ${label}`);
  return item.status;
}

describe("operational checklist", () => {
  it("shows safe fallback statuses when AI and SINAPI are not configured", () => {
    const checklist = createOperationalChecklist(disabledEnvironment, defaultProject);

    expect(getStatus(checklist, "IA")).toBe("desligada");
    expect(getStatus(checklist, "Provider")).toBe("OpenAI");
    expect(getStatus(checklist, "Modelo")).toBe("ausente");
    expect(getStatus(checklist, "Limite diário")).toBe("disponível");
    expect(getStatus(checklist, "SINAPI")).toBe("base ausente");
    expect(getStatus(checklist, "UF")).toBe("definida");
    expect(getStatus(checklist, "Referência")).toBe("ausente");
    expect(getStatus(checklist, "Regime")).toBe("ausente");
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

    expect(getStatus(checklist, "IA")).toBe("ativa");
    expect(getStatus(checklist, "SINAPI")).toBe("base importada");
    expect(getStatus(checklist, "Referência")).toBe("definida");
    expect(getStatus(checklist, "Regime")).toBe("definido");
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

    expect(getStatus(checklist, "IA")).toBe("ativa");
    expect(getStatus(checklist, "Modelo")).toBe("ausente");
  });
});
