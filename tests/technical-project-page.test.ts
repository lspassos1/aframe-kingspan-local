import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import type { Project, Scenario } from "@/types/project";

function createMasonryProject(): { project: Project; scenario: Scenario } {
  const scenario: Scenario = {
    ...defaultProject.scenarios[0],
    id: "scenario-masonry-page",
    constructionMethod: "conventional-masonry",
    methodInputs: {
      ...defaultProject.scenarios[0].methodInputs,
      "conventional-masonry": {
        widthM: 9,
        depthM: 11,
        floors: 1,
        floorHeightM: 3,
        internalWallLengthM: 18,
        blockType: "ceramic",
        wallThicknessM: 0.14,
        doorCount: 2,
        doorWidthM: 0.8,
        doorHeightM: 2.1,
        windowCount: 4,
        windowWidthM: 1.2,
        windowHeightM: 1,
        foundationType: "placeholder",
        roofType: "simple-roof",
        internalPlaster: true,
        externalPlaster: true,
        subfloor: true,
        basicFinish: false,
        wastePercent: 10,
      },
    },
  };

  return {
    scenario,
    project: {
      ...defaultProject,
      selectedScenarioId: scenario.id,
      scenarios: [scenario],
    },
  };
}

describe("TechnicalProjectPage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders a method-aware technical summary for masonry instead of A-frame drawings", async () => {
    const { project, scenario } = createMasonryProject();

    vi.doMock("@/lib/store/project-store", () => ({
      useProjectStore: (selector: (state: { project: Project }) => unknown) => selector({ project }),
      useSelectedScenario: () => scenario,
    }));

    const { default: TechnicalProjectPage } = await import("@/app/technical-project/page");
    const html = renderToStaticMarkup(createElement(TechnicalProjectPage));

    expect(html).toContain("Resumo técnico preliminar - Alvenaria convencional");
    expect(html).toContain("Métricas técnicas");
    expect(html).toContain("Paineis/blocos");
    expect(html).toContain("Quantitativos preliminares");
    expect(html).toContain("Bloco ceramico para alvenaria preliminar");
    expect(html).not.toContain("Desenhos preliminares gerados por SVG");
    expect(html).not.toContain("Desenho SVG preliminar");
  }, 10000);
});
