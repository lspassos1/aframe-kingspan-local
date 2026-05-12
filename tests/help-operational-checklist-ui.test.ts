import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import type { OperationalEnvironmentStatus } from "@/lib/operations/operational-checklist";

vi.mock("@/lib/store/project-store", () => ({
  useProjectStore: (selector: (state: { project: typeof defaultProject }) => unknown) => selector({ project: defaultProject }),
}));

import { OperationalChecklist } from "@/components/help/OperationalChecklist";

const paidEnvironment: OperationalEnvironmentStatus = {
  aiPlanExtractEnabled: false,
  aiMode: "paid",
  aiProviderConfigured: false,
  aiModelConfigured: false,
  providerLabel: "Modo Pro",
  dailyLimitLabel: "3/usuário · 5/IP · 50/global",
};

describe("OperationalChecklist UI", () => {
  it("keeps provider/env details inside advanced diagnostics", () => {
    const html = renderToStaticMarkup(createElement(OperationalChecklist, { environment: paidEnvironment }));

    expect(html).toContain("Diagnóstico seguro de IA, limites, SINAPI e região");
    expect(html).toContain("Ative a análise no ambiente do servidor ou continue pelo preenchimento manual.");
    expect(html).toContain("Complete a configuração do modo atual no servidor.");
    expect(html).toContain("Diagnóstico técnico");
    expect(html).toContain("OPENAI_API_KEY");
    expect(html).toContain("AI_OPENAI_MODEL");
    expect(html).not.toContain("Diagnóstico seguro de IA, OpenAI");
    expect(html.indexOf("OPENAI_API_KEY")).toBeGreaterThan(html.indexOf("Diagnóstico técnico"));
  });
});
