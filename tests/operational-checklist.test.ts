import { describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { createOperationalChecklist, type OperationalEnvironmentStatus } from "@/lib/operations/operational-checklist";
import { createExternalPriceDbOperationalStatus } from "@/lib/pricing/price-db-operations";
import type { PriceSource } from "@/lib/budget-assistant";
import type { Project } from "@/types/project";

vi.mock("server-only", () => ({}));

const disabledEnvironment: OperationalEnvironmentStatus = {
  aiPlanExtractEnabled: false,
  aiMode: "free-cloud",
  aiProviderConfigured: false,
  aiModelConfigured: false,
  aiRateLimitSaltConfigured: false,
  aiRateLimitStorageConfigured: false,
  providerLabel: "Modo gratuito",
  dailyLimitLabel: "3/usuário · 5/IP · 50/global",
  centralPriceDbConfigured: false,
  centralPriceDbLabel: "não configurada",
  lastSemiannualSyncLabel: "sem configuração",
  centralPriceDbOperational: createExternalPriceDbOperationalStatus({ configured: false }),
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
    expect(getStatus(checklist, "daily-limit")).toBe("configurar");
    expect(getStatus(checklist, "local-price-base")).toBe("ausente");
    expect(getStatus(checklist, "central-db")).toBe("não configurada");
    expect(getStatus(checklist, "sinapi")).toBe("base ausente");
    expect(getStatus(checklist, "state")).toBe("definida");
    expect(getStatus(checklist, "reference")).toBe("ausente");
    expect(getStatus(checklist, "semiannual-sync")).toBe("sem configuração");
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
        aiRateLimitSaltConfigured: true,
        aiRateLimitStorageConfigured: true,
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
        aiRateLimitSaltConfigured: true,
        aiRateLimitStorageConfigured: true,
      },
      defaultProject
    );

    expect(getStatus(checklist, "plan-extract")).toBe("ativo");
    expect(getStatus(checklist, "ai-config")).toBe("ausente");
  });

  it("keeps upload assistido pending when rate-limit storage is not ready", () => {
    const checklist = createOperationalChecklist(
      {
        ...disabledEnvironment,
        aiPlanExtractEnabled: true,
        aiProviderConfigured: true,
        aiModelConfigured: true,
        aiRateLimitSaltConfigured: true,
        aiRateLimitStorageConfigured: false,
      },
      defaultProject
    );

    expect(getStatus(checklist, "plan-extract")).toBe("pendente");
    expect(getStatus(checklist, "daily-limit")).toBe("configurar");
    expect(checklist.find((item) => item.id === "daily-limit")?.detail).toContain("proteção diária persistente");
    expect(checklist.find((item) => item.id === "daily-limit")?.technicalDetail).toContain("Storage persistente: ausente");
  });

  it("points paid-mode operators to rate-limit storage when upload assistido is pending", () => {
    const checklist = createOperationalChecklist(
      {
        ...disabledEnvironment,
        aiMode: "paid",
        providerLabel: "Modo Pro",
        aiPlanExtractEnabled: true,
        aiProviderConfigured: true,
        aiModelConfigured: true,
        aiRateLimitSaltConfigured: true,
        aiRateLimitStorageConfigured: false,
      },
      defaultProject
    );
    const planExtract = checklist.find((item) => item.id === "plan-extract");

    expect(planExtract?.status).toBe("pendente");
    expect(planExtract?.technicalDetail).toContain("AI_RATE_LIMIT_SALT");
    expect(planExtract?.technicalDetail).toContain("KV_REST_API_URL/TOKEN");
  });

  it("reports central DB as optional and keeps local fallback available when remote DB is absent", () => {
    const checklist = createOperationalChecklist(disabledEnvironment, defaultProject);

    expect(getStatus(checklist, "central-db")).toBe("não configurada");
    expect(getStatus(checklist, "manual-fallback")).toBe("disponível");
    expect(checklist.find((item) => item.id === "central-db")?.detail).toContain("Base central não é dependência");
  });

  it("reports failed central sync as a warning without exposing raw errors", () => {
    const failedStatus = createExternalPriceDbOperationalStatus({
      configured: true,
      latestSource: { referenceMonth: "2026-05", status: "active" },
      latestSyncRun: {
        status: "failed",
        errorMessage: "Authorization Bearer secret-token-12345678901234567890 failed at https://example.supabase.co/rest/v1",
      },
    });
    const checklist = createOperationalChecklist(
      {
        ...disabledEnvironment,
        centralPriceDbConfigured: true,
        centralPriceDbLabel: failedStatus.centralLabel,
        lastSemiannualSyncLabel: failedStatus.syncLabel,
        centralPriceDbOperational: failedStatus,
      },
      defaultProject
    );

    expect(getStatus(checklist, "central-db")).toBe("configurada");
    expect(getStatus(checklist, "semiannual-sync")).toBe("falha no sync");
    expect(checklist.find((item) => item.id === "semiannual-sync")?.tone).toBe("warning");
    expect(JSON.stringify(checklist)).not.toContain("secret-token");
    expect(JSON.stringify(checklist)).not.toContain("example.supabase.co");
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
