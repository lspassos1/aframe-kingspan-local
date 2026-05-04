import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { getTechnicalProjectViewModel } from "@/lib/technical-project";

const masonryScenario = {
  ...defaultProject.scenarios[0],
  id: "scenario-masonry",
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

describe("technical project view model", () => {
  it("keeps A-frame on the current SVG drawing path", () => {
    const viewModel = getTechnicalProjectViewModel(defaultProject, defaultProject.scenarios[0]);

    expect(viewModel.mode).toBe("drawings");
    if (viewModel.mode === "drawings") {
      expect(viewModel.methodName).toBe("A-frame com paineis");
      expect(viewModel.drawings.length).toBeGreaterThan(0);
      expect(viewModel.drawings.some((drawing) => drawing.svg.includes("A-frame"))).toBe(true);
    }
  });

  it("escapes user-provided text before rendering A-frame SVG drawings", () => {
    const unsafeProject = {
      ...defaultProject,
      name: '<script>alert("x")</script>',
    };
    const unsafeScenario = {
      ...defaultProject.scenarios[0],
      location: {
        ...defaultProject.scenarios[0].location,
        city: "Cidade <img>",
        state: "SP & RJ",
      },
    };

    const viewModel = getTechnicalProjectViewModel(unsafeProject, unsafeScenario);

    expect(viewModel.mode).toBe("drawings");
    if (viewModel.mode === "drawings") {
      const coverSvg = viewModel.drawings.find((drawing) => drawing.id === "cover")?.svg ?? "";

      expect(coverSvg).not.toContain("<script>");
      expect(coverSvg).not.toContain("<img>");
      expect(coverSvg).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
      expect(coverSvg).toContain("Cidade &lt;img&gt;, SP &amp; RJ");
    }
  });

  it("uses method-aware summaries instead of A-frame drawings for masonry", () => {
    const viewModel = getTechnicalProjectViewModel(defaultProject, masonryScenario);

    expect(viewModel.mode).toBe("summary");
    if (viewModel.mode === "summary") {
      expect(viewModel.methodName).toBe("Alvenaria convencional");
      expect(viewModel.metrics.some((metric) => metric.label === "Area construida")).toBe(true);
      expect(viewModel.materialLines.some((line) => line.id === "masonry-blocks")).toBe(true);
      expect(viewModel.warnings.length).toBeGreaterThan(0);
    }
  });
});
