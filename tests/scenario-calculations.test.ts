import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import {
  calculateScenarioBudget,
  calculateScenarioMaterials,
  generateScenarioQuotationRequests,
  generateScenarioTechnicalSummary,
} from "@/lib/construction-methods/scenario-calculations";
import { compareScenarios } from "@/lib/calculations/scenarios";

const masonryScenario = {
  ...defaultProject.scenarios[0],
  id: "scenario-masonry",
  name: "Masonry",
  constructionMethod: "conventional-masonry" as const,
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

describe("method-aware scenario calculations", () => {
  it("routes materials and budget through the selected method", () => {
    const materials = calculateScenarioMaterials(defaultProject, masonryScenario);
    const budget = calculateScenarioBudget(defaultProject, masonryScenario);

    expect(materials.some((line) => line.id === "masonry-blocks")).toBe(true);
    expect(budget.items.some((item) => item.id === "masonry-civil-placeholder")).toBe(true);
  });

  it("generates method-aware quotations and technical summaries", () => {
    const requests = generateScenarioQuotationRequests(defaultProject, masonryScenario);
    const summary = generateScenarioTechnicalSummary(defaultProject, masonryScenario);

    expect(requests).toHaveLength(1);
    expect(requests[0].body).toContain("Metodo construtivo: Alvenaria convencional");
    expect(summary.methodName).toBe("Alvenaria convencional");
    expect(summary.metrics.some((metric) => metric.label === "Area construida")).toBe(true);
    expect(summary.warnings.length).toBeGreaterThan(0);
  });

  it("compares mixed-method scenarios without falling back to A-frame-only quantities", () => {
    const rows = compareScenarios({
      ...defaultProject,
      scenarios: [defaultProject.scenarios[0], masonryScenario],
    });

    expect(rows).toHaveLength(2);
    expect(rows[1].id).toBe("scenario-masonry");
    expect(rows[1].groundTotalArea).toBe(99);
    expect(rows[1].fitsTerrain).toBe(true);
    expect(rows[1].totalPanels).toBeGreaterThan(0);
  });

  it("uses one-floor footprint area and terrain fit for non-A-frame comparison rows", () => {
    const multiFloorScenario = {
      ...masonryScenario,
      id: "scenario-masonry-two-floors",
      methodInputs: {
        ...masonryScenario.methodInputs,
        "conventional-masonry": {
          ...masonryScenario.methodInputs["conventional-masonry"],
          floors: 2,
        },
      },
    };
    const oversizedScenario = {
      ...masonryScenario,
      id: "scenario-masonry-oversized",
      methodInputs: {
        ...masonryScenario.methodInputs,
        "conventional-masonry": {
          ...masonryScenario.methodInputs["conventional-masonry"],
          widthM: 20,
        },
      },
    };

    const rows = compareScenarios({
      ...defaultProject,
      scenarios: [multiFloorScenario, oversizedScenario],
    });

    expect(rows[0].groundTotalArea).toBe(99);
    expect(rows[0].groundUsefulArea).toBe(99);
    expect(rows[0].height).toBe(6);
    expect(rows[0].fitsTerrain).toBe(true);
    expect(rows[1].fitsTerrain).toBe(false);
  });
});
