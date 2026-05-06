import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import {
  createTakeoffSeedInputFromPlanExtract,
  generatePlanExtractQuantitySeeds,
  generateScenarioQuantitySeeds,
  generateTakeoffQuantitySeeds,
  type TakeoffSeedInput,
} from "@/lib/takeoff/quantity-seeds";
import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";

const manualInput: TakeoffSeedInput = {
  scenarioId: "manual-scenario",
  constructionMethod: "conventional-masonry",
  widthM: 8,
  depthM: 10,
  floors: 1,
  floorHeightM: 2.8,
  internalWallLengthM: 18,
  externalAreaM2: 28,
  openings: {
    doorCount: 4,
    windowCount: 6,
  },
  rooms: [
    { id: "sala", name: "Sala", areaM2: 18 },
    { id: "cozinha", name: "Cozinha", areaM2: 10, wetArea: true },
    { id: "banheiro", name: "Banheiro", areaM2: 4, wetArea: true },
  ],
  source: "manual",
};

const planExtractResult: PlanExtractResult = {
  version: "1.0",
  summary: "Planta com cotas principais.",
  confidence: "medium",
  extractionStatus: "partial",
  extracted: {
    constructionMethod: "conventional-masonry",
    houseWidthM: 8,
    houseDepthM: 10,
    floorHeightM: 2.8,
    floors: 1,
    doorCount: 4,
    windowCount: 6,
    notes: [],
  },
  building: {
    widthM: {
      value: 8,
      unit: "m",
      confidence: "medium",
      evidence: "Cota frontal visivel.",
      source: "visible",
      requiresReview: true,
    },
    depthM: {
      value: 10,
      unit: "m",
      confidence: "medium",
      evidence: "Cota lateral visivel.",
      source: "visible",
      requiresReview: true,
    },
    builtAreaM2: {
      value: 80,
      unit: "m2",
      confidence: "medium",
      evidence: "Area calculada por cotas principais.",
      source: "calculated",
      requiresReview: true,
    },
  },
  rooms: [
    {
      id: "room-bath",
      name: {
        value: "Banheiro",
        unit: "texto",
        confidence: "medium",
        evidence: "Texto Banheiro visivel.",
        source: "visible",
        requiresReview: true,
      },
      wetArea: {
        value: true,
        unit: "booleano",
        confidence: "medium",
        evidence: "Loucas visiveis no ambiente.",
        source: "visible",
        requiresReview: true,
      },
    },
  ],
  quantitySeeds: [
    {
      id: "ai-visible-floor",
      category: "flooring",
      description: "Area escrita na prancha",
      quantity: 80,
      unit: "m2",
      source: "ai_visible",
      confidence: "medium",
      requiresReview: true,
      notes: "Area informada no quadro de areas.",
    },
  ],
  fieldConfidence: {},
  assumptions: [],
  missingInformation: [],
  warnings: [],
};

describe("takeoff quantity seeds", () => {
  it("generates deterministic seeds for manual dimensions and opening counts", () => {
    const seeds = generateTakeoffQuantitySeeds(manualInput);
    const ids = seeds.map((seed) => seed.id);

    expect(ids).toContain("manual-scenario-foundation-footprint");
    expect(ids).toContain("manual-scenario-external-walls-area");
    expect(ids).toContain("manual-scenario-internal-walls-area");
    expect(ids).toContain("manual-scenario-walls-gross-area");
    expect(ids).toContain("manual-scenario-walls-net-area");
    expect(ids).toContain("manual-scenario-flooring-area");
    expect(ids).toContain("manual-scenario-subfloor-area");
    expect(ids).toContain("manual-scenario-ceiling-area");
    expect(ids).toContain("manual-scenario-wall-finishes-area");
    expect(ids).toContain("manual-scenario-internal-plaster-area");
    expect(ids).toContain("manual-scenario-external-plaster-area");
    expect(ids).toContain("manual-scenario-internal-paint-area");
    expect(ids).toContain("manual-scenario-external-paint-area");
    expect(ids).toContain("manual-scenario-wet-wall-tile-area");
    expect(ids).toContain("manual-scenario-baseboard-length");
    expect(ids).toContain("manual-scenario-doors-count");
    expect(ids).toContain("manual-scenario-windows-count");
    expect(ids).toContain("manual-scenario-roof-area");
    expect(ids).toContain("manual-scenario-electrical-points");
    expect(ids).toContain("manual-scenario-plumbing-points");
    expect(ids).toContain("manual-scenario-fixtures-metals");
    expect(ids).toContain("manual-scenario-external-area");

    expect(seeds.find((seed) => seed.id === "manual-scenario-flooring-area")).toMatchObject({
      category: "flooring",
      quantity: 80,
      unit: "m2",
      source: "manual",
      requiresReview: true,
    });
    expect(seeds.find((seed) => seed.id === "manual-scenario-doors-count")?.quantity).toBe(4);
    expect(seeds.find((seed) => seed.id === "manual-scenario-windows-count")?.quantity).toBe(6);
  });

  it("keeps technical estimates pending and low confidence", () => {
    const seeds = generateTakeoffQuantitySeeds(manualInput);
    const technicalSeeds = seeds.filter((seed) => ["foundation", "roof", "electrical", "plumbing"].includes(seed.category));

    expect(technicalSeeds.length).toBeGreaterThan(0);
    expect(technicalSeeds.every((seed) => seed.requiresReview)).toBe(true);
    expect(technicalSeeds.every((seed) => seed.pendingReason)).toBe(true);
    expect(technicalSeeds.filter((seed) => seed.source === "rule_estimated").every((seed) => seed.confidence === "low")).toBe(true);
  });

  it("does not generate labor hour or H/H seeds", () => {
    const seeds = generateTakeoffQuantitySeeds(manualInput);

    expect(seeds.some((seed) => String(seed.category) === "labor")).toBe(false);
    expect(seeds.some((seed) => String(seed.unit) === "h")).toBe(false);
  });

  it("derives scenario seeds without mutating the project baseline", () => {
    const before = JSON.stringify(defaultProject);
    const scenario = defaultProject.scenarios[0];
    const seeds = generateScenarioQuantitySeeds(defaultProject, scenario);

    expect(JSON.stringify(defaultProject)).toBe(before);
    expect(seeds.some((seed) => seed.scenarioId === scenario.id)).toBe(true);
    expect(seeds.some((seed) => seed.category === "roof")).toBe(true);
    expect(seeds.some((seed) => seed.constructionMethod === "aframe")).toBe(true);
  });

  it("creates seed input and generated quantities from plan extraction data", () => {
    const input = createTakeoffSeedInputFromPlanExtract(planExtractResult, { scenarioId: "plan-scenario" });
    const seeds = generatePlanExtractQuantitySeeds(planExtractResult, { scenarioId: "plan-scenario" });

    expect(input).toMatchObject({
      scenarioId: "plan-scenario",
      constructionMethod: "conventional-masonry",
      widthM: 8,
      depthM: 10,
      builtAreaM2: 80,
      source: "ai_visible",
    });
    expect(seeds.some((seed) => seed.id === "plan-scenario-flooring-area")).toBe(true);
    expect(seeds.find((seed) => seed.id === "ai-visible-floor")).toMatchObject({
      source: "ai_visible",
      requiresReview: true,
      quantity: 80,
    });
    expect(seeds.every((seed) => seed.requiresReview)).toBe(true);
  });
});
