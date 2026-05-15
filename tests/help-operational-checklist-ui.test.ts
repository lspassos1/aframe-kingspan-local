import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import type { OperationalEnvironmentStatus } from "@/lib/operations/operational-checklist";
import { createExternalPriceDbOperationalStatus } from "@/lib/pricing/price-db-operations";

vi.mock("@/lib/store/project-store", () => ({
  useProjectStore: (selector: (state: { project: typeof defaultProject }) => unknown) => selector({ project: defaultProject }),
}));

import { OperationalChecklist } from "@/components/help/OperationalChecklist";

const paidEnvironment: OperationalEnvironmentStatus = {
  aiPlanExtractEnabled: false,
  aiMode: "paid",
  aiProviderConfigured: false,
  aiModelConfigured: false,
  aiRateLimitSaltConfigured: false,
  aiRateLimitStorageConfigured: false,
  aiDiagnosticsStorageConfigured: false,
  providerLabel: "Modo Pro",
  dailyLimitLabel: "3/usuário · 5/IP · 50/global",
  centralPriceDbConfigured: false,
  centralPriceDbLabel: "não configurada",
  lastSemiannualSyncLabel: "sem configuração",
  centralPriceDbOperational: createExternalPriceDbOperationalStatus({ configured: false }),
};

describe("OperationalChecklist UI", () => {
  it("keeps provider/env details inside advanced diagnostics", () => {
    const html = renderToStaticMarkup(createElement(OperationalChecklist, { environment: paidEnvironment }));

    expect(html).toContain("Diagnóstico seguro de IA, preços, importação e exportação");
    expect(html).toContain("Continue pelo preenchimento manual enquanto a proteção diária é configurada.");
    expect(html).toContain("Complete a configuração do modo atual no servidor.");
    expect(html).toContain("Base central não é dependência");
    expect(html).toContain("Fallback manual");
    expect(html).toContain("Exportação");
    expect(html).toContain("Diagnóstico técnico");
    expect(html).toContain("OPENAI_API_KEY");
    expect(html).toContain("AI_OPENAI_MODEL");
    expect(html).not.toContain("sk-");
    expect(html).not.toContain("service role");
    expect(html).not.toContain("Diagnóstico seguro de IA, OpenAI");
    expect(html.indexOf("OPENAI_API_KEY")).toBeGreaterThan(html.indexOf("Diagnóstico técnico"));
  });
});
