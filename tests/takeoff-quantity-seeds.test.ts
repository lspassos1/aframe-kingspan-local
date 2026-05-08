import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import {
  createTakeoffSeedInputFromScenario,
  createTakeoffSeedInputFromPlanExtract,
  generatePlanExtractQuantitySeeds,
  generateScenarioQuantitySeeds,
  generateTakeoffQuantitySeeds,
  type TakeoffSeedInput,
} from "@/lib/takeoff/quantity-seeds";
import { createDefaultManualTakeoffState, createManualTakeoffDataFromState } from "@/lib/takeoff/manual-stepper";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import type { PlanExtractResult } from "@/lib/ai/plan-extract-schema";
import type { Project } from "@/types/project";

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

  it("prefers persisted manual rooms and openings when generating scenario seeds", () => {
    const masonryDefinition = getConstructionMethodDefinition("conventional-masonry");
    const manualState = createDefaultManualTakeoffState({
      projectName: "Manual persistido",
      lotWidthM: 14,
      lotDepthM: 26,
      frontSetbackM: 4,
      rearSetbackM: 3,
      leftSetbackM: 1.5,
      rightSetbackM: 1.5,
      buildingWidthM: 9,
      buildingDepthM: 11,
      floorHeightM: 2.9,
      rooms: [
        { ...createDefaultManualTakeoffState().rooms[0], id: "room-suite", name: "Suite", areaM2: 16, wetArea: true, electricalPoints: 7, plumbingPoints: 5 },
      ],
      openings: [
        { ...createDefaultManualTakeoffState().openings[0], id: "door-suite", kind: "door", quantity: 2, widthM: 0.9, heightM: 2.1, roomId: "room-suite" },
        { ...createDefaultManualTakeoffState().openings[1], id: "window-suite", kind: "window", quantity: 3, widthM: 1.5, heightM: 1.1, roomId: "room-suite" },
      ],
      electricalEstimated: false,
      electricalPoints: 21,
      plumbingEstimated: false,
      plumbingPoints: 8,
    });
    const project: Project = {
      ...defaultProject,
      scenarios: [
        {
          ...defaultProject.scenarios[0],
          constructionMethod: "conventional-masonry",
          terrain: {
            ...defaultProject.scenarios[0].terrain,
            width: 14,
            depth: 26,
            frontSetback: 4,
            rearSetback: 3,
            leftSetback: 1.5,
            rightSetback: 1.5,
          },
          methodInputs: {
            ...defaultProject.scenarios[0].methodInputs,
            "conventional-masonry": {
              ...masonryDefinition.getDefaultInputs(),
              widthM: 9,
              depthM: 11,
              floors: 1,
              floorHeightM: 2.9,
              internalWallLengthM: manualState.internalWallLengthM,
              doorCount: 2,
              windowCount: 3,
              doorWidthM: 0.9,
              doorHeightM: 2.1,
              windowWidthM: 1.5,
              windowHeightM: 1.1,
            },
          },
          manualTakeoff: createManualTakeoffDataFromState(manualState, "2026-05-08T20:00:00.000Z"),
        },
      ],
    };
    const scenario = project.scenarios[0];
    const input = createTakeoffSeedInputFromScenario(project, scenario);
    const seeds = generateScenarioQuantitySeeds(project, scenario);

    expect(input).toMatchObject({
      widthM: 9,
      depthM: 11,
      source: "manual",
      electricalPointCount: 21,
      plumbingPointCount: 8,
    });
    expect(input.rooms).toEqual([{ id: "room-suite", name: "Suite", type: "social", areaM2: 16, wetArea: true }]);
    expect(input.openings).toMatchObject({ doorCount: 2, windowCount: 3, doorWidthM: 0.9, windowWidthM: 1.5 });
    expect(seeds.find((seed) => seed.id === `${scenario.id}-doors-count`)?.quantity).toBe(2);
    expect(seeds.find((seed) => seed.id === `${scenario.id}-windows-count`)?.quantity).toBe(3);
    expect(seeds.find((seed) => seed.id === `${scenario.id}-electrical-points`)).toMatchObject({
      quantity: 21,
      source: "manual",
      confidence: "medium",
    });
  });

  it("falls back to live scenario inputs when persisted manual takeoff is stale", () => {
    const masonryDefinition = getConstructionMethodDefinition("conventional-masonry");
    const manualState = createDefaultManualTakeoffState({
      lotWidthM: 14,
      lotDepthM: 26,
      buildingWidthM: 9,
      buildingDepthM: 11,
      floorHeightM: 2.9,
      openings: [
        { ...createDefaultManualTakeoffState().openings[0], id: "door-suite", kind: "door", quantity: 2, widthM: 0.9, heightM: 2.1 },
        { ...createDefaultManualTakeoffState().openings[1], id: "window-suite", kind: "window", quantity: 3, widthM: 1.5, heightM: 1.1 },
      ],
    });
    const project: Project = {
      ...defaultProject,
      scenarios: [
        {
          ...defaultProject.scenarios[0],
          constructionMethod: "conventional-masonry",
          terrain: {
            ...defaultProject.scenarios[0].terrain,
            width: 14,
            depth: 26,
          },
          methodInputs: {
            ...defaultProject.scenarios[0].methodInputs,
            "conventional-masonry": {
              ...masonryDefinition.getDefaultInputs(),
              widthM: 13,
              depthM: 11,
              floors: 1,
              floorHeightM: 2.9,
              internalWallLengthM: manualState.internalWallLengthM,
              doorCount: 7,
              windowCount: 8,
            },
          },
          manualTakeoff: createManualTakeoffDataFromState(manualState, "2026-05-08T20:00:00.000Z"),
        },
      ],
    };
    const scenario = project.scenarios[0];
    const input = createTakeoffSeedInputFromScenario(project, scenario);
    const seeds = generateScenarioQuantitySeeds(project, scenario);

    expect(input).toMatchObject({
      widthM: 13,
      depthM: 11,
      source: "system_calculated",
      openings: { doorCount: 7, windowCount: 8 },
    });
    expect(seeds.find((seed) => seed.id === `${scenario.id}-doors-count`)?.quantity).toBe(7);
    expect(seeds.find((seed) => seed.id === `${scenario.id}-windows-count`)?.quantity).toBe(8);
  });

  it("uses persisted A-frame manual takeoff only while live geometry metrics match", () => {
    const scenario = defaultProject.scenarios[0];
    const liveInput = createTakeoffSeedInputFromScenario(defaultProject, scenario);
    const widthM = liveInput.widthM ?? 8;
    const depthM = liveInput.depthM ?? scenario.aFrame.houseDepth;
    const footprintAreaM2 = liveInput.footprintAreaM2 ?? widthM * depthM;
    const builtAreaM2 = liveInput.builtAreaM2 ?? footprintAreaM2;
    const roofAreaM2 = liveInput.roofAreaM2 ?? footprintAreaM2;
    const floorHeightM = liveInput.floorHeightM ?? 2.8;
    const roofSlopeFactor = roofAreaM2 / (widthM * depthM);
    const manualState = createDefaultManualTakeoffState({
      lotWidthM: scenario.terrain.width,
      lotDepthM: scenario.terrain.depth,
      frontSetbackM: scenario.terrain.frontSetback,
      rearSetbackM: scenario.terrain.rearSetback,
      leftSetbackM: scenario.terrain.leftSetback,
      rightSetbackM: scenario.terrain.rightSetback,
      buildingWidthM: widthM,
      buildingDepthM: depthM,
      floors: liveInput.floors ?? 1,
      floorHeightM,
      rooms: [{ ...createDefaultManualTakeoffState().rooms[0], id: "room-aframe", name: "Volume A-frame", areaM2: builtAreaM2, widthM, depthM }],
      openings: [],
      foundationAreaM2: footprintAreaM2,
      roofEaveM: 0,
      roofSlopeFactor,
    });
    const manualTakeoff = createManualTakeoffDataFromState(manualState, "2026-05-08T20:00:00.000Z");
    const projectWithCurrentManual: Project = {
      ...defaultProject,
      scenarios: [{ ...scenario, manualTakeoff }],
    };
    const staleAFrame = { ...scenario.aFrame, panelLength: scenario.aFrame.panelLength + 1 };
    const projectWithStaleManual: Project = {
      ...projectWithCurrentManual,
      scenarios: [
        {
          ...projectWithCurrentManual.scenarios[0],
          aFrame: staleAFrame,
          methodInputs: {
            ...projectWithCurrentManual.scenarios[0].methodInputs,
            aframe: staleAFrame,
          },
        },
      ],
    };

    expect(createTakeoffSeedInputFromScenario(projectWithCurrentManual, projectWithCurrentManual.scenarios[0]).source).toBe("manual");
    expect(createTakeoffSeedInputFromScenario(projectWithStaleManual, projectWithStaleManual.scenarios[0]).source).toBe("system_calculated");
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
