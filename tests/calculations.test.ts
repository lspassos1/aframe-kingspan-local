import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { calculateBudget, isPriceStale } from "@/lib/calculations/budget";
import { estimateRadierFoundation } from "@/lib/calculations/foundation";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { calculateMaterialList, calculatePanelLayout } from "@/lib/calculations/materials";
import { compareScenarios } from "@/lib/calculations/scenarios";
import { estimateSteelStructure } from "@/lib/calculations/structure";

const scenario = defaultProject.scenarios[0];
const panel = defaultProject.panelProducts.find((item) => item.id === scenario.panelProductId) ?? defaultProject.panelProducts[0];

describe("A-frame geometry", () => {
  it("calculates width, ridge height and useful ground area", () => {
    const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);

    expect(geometry.baseWidth).toBeCloseTo(9.64, 1);
    expect(geometry.ridgeHeight).toBeCloseTo(5.75, 1);
    expect(geometry.groundUsefulWidth).toBeCloseTo(7.13, 1);
    expect(geometry.groundUsefulArea).toBeCloseTo(123.25, 1);
  });

  it("supports automatic depth for target useful area", () => {
    const geometry = calculateAFrameGeometry(scenario.terrain, {
      ...scenario.aFrame,
      automaticDepth: true,
      targetGroundUsefulArea: 130,
    });

    expect(geometry.groundUsefulArea).toBeCloseTo(130, 1);
    expect(geometry.effectiveHouseDepth).toBeGreaterThan(17);
  });

  it("detects terrain fit failures", () => {
    const geometry = calculateAFrameGeometry({ ...scenario.terrain, width: 8 }, scenario.aFrame);

    expect(geometry.fitsTerrain).toBe(false);
    expect(geometry.warnings.some((warning) => warning.id.includes("width"))).toBe(true);
  });
});

describe("materials and budget", () => {
  it("calculates panel quantity from depth and useful width", () => {
    const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
    const layout = calculatePanelLayout(scenario, geometry, panel, 0);

    expect(layout.panelsPerSlope).toBe(18);
    expect(layout.totalPanels).toBe(36);
    expect(layout.totalPanelAreaM2).toBe(270);
  });

  it("splits roof panels when requested length exceeds available maximum", () => {
    const geometry = calculateAFrameGeometry(scenario.terrain, { ...scenario.aFrame, panelLength: 9 });
    const layout = calculatePanelLayout(
      { ...scenario, aFrame: { ...scenario.aFrame, panelLength: 9 } },
      geometry,
      { ...panel, maxLengthM: 7.5, lengthStepM: 1 },
      0
    );

    expect(layout.panelLengthExceeded).toBe(true);
    expect(layout.segmentsPerPanel).toBe(2);
    expect(layout.panelSegmentLengthM).toBe(5);
  });

  it("generates material list with real quotation seed items", () => {
    const lines = calculateMaterialList(defaultProject, scenario);

    expect(lines.some((line) => line.code === "PAR COSTURA PB1/4-14 X 7/8 P1")).toBe(true);
    expect(lines.find((line) => line.id === "massa-vedante")?.requiresConfirmation).toBe(true);
  });

  it("keeps freight separate and computes totals", () => {
    const budget = calculateBudget(defaultProject, scenario);

    expect(budget.panelPackageCostBRL).toBeCloseTo(56699.64, 1);
    expect(budget.freightBRL).toBe(0);
    expect(budget.foundationCostBRL).toBeGreaterThan(0);
    expect(budget.totalEstimatedCostBRL).toBeGreaterThan(budget.panelPackageCostBRL);
  });

  it("estimates radier foundation quantities from current footprint", () => {
    const foundation = estimateRadierFoundation(scenario, defaultProject.foundationAssumptions);

    expect(foundation.areaM2).toBeGreaterThan(150);
    expect(foundation.concreteM3).toBeGreaterThan(20);
    expect(foundation.totalBRL).toBeGreaterThan(0);
  });

  it("marks stale quotation dates", () => {
    expect(isPriceStale("2025-11-20", 90, new Date("2026-04-26T00:00:00"))).toBe(true);
  });
});

describe("structure and scenarios", () => {
  it("estimates preliminary steel quantities", () => {
    const estimate = estimateSteelStructure(defaultProject, scenario);

    expect(estimate.frameCount).toBeGreaterThan(2);
    expect(estimate.totalSteelKg).toBeGreaterThan(0);
    expect(estimate.candidates.length).toBeGreaterThanOrEqual(3);
  });

  it("compares default scenarios", () => {
    const rows = compareScenarios(defaultProject);

    expect(rows.length).toBeGreaterThanOrEqual(7);
    expect(rows[0].totalPanels).toBe(36);
  });
});
