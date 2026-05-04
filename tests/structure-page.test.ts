import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const scenario = {
    id: "scenario-masonry",
    name: "Alvenaria",
    constructionMethod: "conventional-masonry",
    methodInputs: {},
  };

  return {
    estimateSteelStructure: vi.fn(() => {
      throw new Error("A-frame steel structure calculation should not run for non-A-frame methods.");
    }),
    scenario,
    state: {
      project: {
        selectedScenarioId: scenario.id,
        scenarios: [scenario],
      },
      updateStructuralInputs: vi.fn(),
      updateSteelProfile: vi.fn(),
    },
  };
});

vi.mock("@/lib/calculations/structure", () => ({
  estimateSteelStructure: mocks.estimateSteelStructure,
}));

vi.mock("@/lib/store/project-store", () => ({
  useProjectStore: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
  useSelectedScenario: () => mocks.scenario,
}));

import StructurePage from "@/app/structure/page";

describe("StructurePage", () => {
  beforeEach(() => {
    mocks.estimateSteelStructure.mockClear();
  });

  it("shows the non-A-frame guard instead of A-frame calculations", () => {
    const html = renderToStaticMarkup(createElement(StructurePage));

    expect(html).toContain("Estrutura metalica nao se aplica a Alvenaria convencional");
    expect(html).toContain("Continuar com o metodo ativo");
    expect(html).toContain('href="/technical-project"');
    expect(html).toContain("Projeto tecnico");
    expect(html).toContain('href="/materials"');
    expect(html).toContain("Materiais");
    expect(html).toContain('href="/budget"');
    expect(html).toContain("Orcamento");
    expect(html).not.toContain("Pre-dimensionamento estrutural A-frame");
    expect(html).not.toContain("Porticos");
    expect(mocks.estimateSteelStructure).not.toHaveBeenCalled();
  });
});
