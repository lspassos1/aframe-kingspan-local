import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { createDefaultManualTakeoffState, createManualTakeoffDataFromState, normalizeManualTakeoffProjectData } from "@/lib/takeoff/manual-stepper";
import { normalizeProject } from "@/lib/store/project-normalization";
import type { AFrameInputs, Project } from "@/types/project";

describe("project serialization and normalization", () => {
  it("round-trips a valid project through JSON without losing core fields", () => {
    const parsed = JSON.parse(JSON.stringify(defaultProject)) as Project;

    expect(parsed.id).toBe(defaultProject.id);
    expect(parsed.name).toBe(defaultProject.name);
    expect(parsed.selectedScenarioId).toBe(defaultProject.selectedScenarioId);
    expect(parsed.scenarios).toHaveLength(defaultProject.scenarios.length);
    expect(parsed.scenarios[0].constructionMethod).toBe("aframe");
    expect(parsed.scenarios[0].methodInputs.aframe).toMatchObject(parsed.scenarios[0].aFrame);
    expect(parsed.panelProducts).toHaveLength(defaultProject.panelProducts.length);
    expect(parsed.materialAssumptions).toMatchObject(defaultProject.materialAssumptions);
    expect(parsed.budgetAssumptions.contingencyPercent).toBe(defaultProject.budgetAssumptions.contingencyPercent);
    expect(parsed.budgetAssumptions.panelInstallationLaborBRLM2).toBe(defaultProject.budgetAssumptions.panelInstallationLaborBRLM2);
    expect(parsed.budgetAssumptions.engineerPlaceholderBRL).toBe(defaultProject.budgetAssumptions.engineerPlaceholderBRL);
    expect(parsed.foundationAssumptions).toMatchObject(defaultProject.foundationAssumptions);
    expect(parsed.budgetAssistant).toMatchObject(defaultProject.budgetAssistant);
  });

  it("round-trips dedicated manual takeoff collections through project JSON", () => {
    const manualState = createDefaultManualTakeoffState({
      projectName: "Manual persistido",
      rooms: [createDefaultManualTakeoffState().rooms[0]],
      openings: [createDefaultManualTakeoffState().openings[0]],
      electricalEstimated: false,
      electricalPoints: 18,
    });
    const manualTakeoff = createManualTakeoffDataFromState(manualState, "2026-05-08T20:00:00.000Z");
    const project: Project = {
      ...defaultProject,
      scenarios: [
        {
          ...defaultProject.scenarios[0],
          manualTakeoff,
        },
      ],
    };
    const parsed = JSON.parse(JSON.stringify(project)) as Project;

    expect(parsed.scenarios[0].manualTakeoff?.rooms).toHaveLength(1);
    expect(parsed.scenarios[0].manualTakeoff?.openings).toHaveLength(1);
    expect(parsed.scenarios[0].manualTakeoff?.wallMetrics.externalWallLengthM).toBe(manualState.externalWallLengthM);
    expect(parsed.scenarios[0].manualTakeoff?.mep.electricalPoints).toBe(18);
  });

  it("preserves empty manual takeoff collections during normalization", () => {
    const manualTakeoff = createManualTakeoffDataFromState(
      createDefaultManualTakeoffState({
        rooms: [],
        openings: [],
      }),
      "2026-05-08T20:00:00.000Z"
    );
    const project: Project = {
      ...defaultProject,
      scenarios: [
        {
          ...defaultProject.scenarios[0],
          manualTakeoff,
        },
      ],
    };

    const normalized = normalizeProject(project);

    expect(normalized.scenarios[0].manualTakeoff?.rooms).toEqual([]);
    expect(normalized.scenarios[0].manualTakeoff?.openings).toEqual([]);
  });

  it("normalizes manual takeoff timestamps when imported data lacks updatedAt", () => {
    const missingTimestamp = normalizeManualTakeoffProjectData({
      version: 1,
      source: "manual-stepper",
      rooms: [],
      openings: [],
    });
    const emptyTimestamp = normalizeManualTakeoffProjectData({
      version: 1,
      updatedAt: "",
      source: "manual-stepper",
      rooms: [],
      openings: [],
    });
    const invalidTimestamp = normalizeManualTakeoffProjectData({
      version: 1,
      updatedAt: "not-a-date",
      source: "manual-stepper",
      rooms: [],
      openings: [],
    });

    for (const normalized of [missingTimestamp, emptyTimestamp, invalidTimestamp]) {
      expect(normalized?.updatedAt).toBeTruthy();
      expect(normalized?.updatedAt).not.toBe("");
      expect(Number.isNaN(Date.parse(normalized?.updatedAt ?? ""))).toBe(false);
    }
  });

  it("uses current scenario width as fallback for imported manual takeoff geometry", () => {
    const masonryInputs = {
      ...getConstructionMethodDefinition("conventional-masonry").getDefaultInputs(),
      widthM: 10.5,
      depthM: 12,
      floors: 1,
      floorHeightM: 2.9,
    };
    const project: Project = {
      ...defaultProject,
      scenarios: [
        {
          ...defaultProject.scenarios[0],
          constructionMethod: "conventional-masonry",
          methodInputs: {
            ...defaultProject.scenarios[0].methodInputs,
            "conventional-masonry": masonryInputs,
          },
          manualTakeoff: {
            version: 1,
            updatedAt: "2026-05-08T20:00:00.000Z",
            source: "manual-stepper",
            site: {
              ...createManualTakeoffDataFromState(createDefaultManualTakeoffState()).site,
              buildingWidthM: undefined as unknown as number,
              buildingDepthM: undefined as unknown as number,
            },
            rooms: [],
            openings: [],
            wallMetrics: createManualTakeoffDataFromState(createDefaultManualTakeoffState()).wallMetrics,
            foundationRoof: createManualTakeoffDataFromState(createDefaultManualTakeoffState()).foundationRoof,
            mep: createManualTakeoffDataFromState(createDefaultManualTakeoffState()).mep,
          },
        },
      ],
    };

    const normalized = normalizeProject(project).scenarios[0].manualTakeoff;

    expect(normalized?.site.buildingWidthM).toBe(10.5);
    expect(normalized?.site.buildingDepthM).toBe(12);
  });

  it("normalizes legacy A-frame mezzanine fields while preserving current defaults", () => {
    const legacyAFrame = {
      ...defaultProject.scenarios[0].aFrame,
      upperFloorMode: undefined,
      upperFloorLevelHeight: undefined,
      upperFloorAreaPercent: undefined,
      mezzanineFloorHeight: 2.6,
      mezzanineDepth: defaultProject.scenarios[0].aFrame.houseDepth / 2,
    } as unknown as AFrameInputs;
    const legacyProject = {
      ...defaultProject,
      scenarios: [
        {
          ...defaultProject.scenarios[0],
          aFrame: legacyAFrame,
        },
      ],
      panelProducts: [],
      accessories: [],
    } as Project;

    const normalized = normalizeProject(legacyProject);
    const normalizedScenario = normalized.scenarios[0];

    expect(normalizedScenario.constructionMethod).toBe("aframe");
    expect(normalizedScenario.methodInputs.aframe).toMatchObject(normalizedScenario.aFrame);
    expect(normalizedScenario.aFrame.upperFloorMode).toBe("full-floor");
    expect(normalizedScenario.aFrame.upperFloorLevelHeight).toBe(2.6);
    expect(normalizedScenario.aFrame.upperFloorAreaPercent).toBe(50);
    expect(normalized.panelProducts).toHaveLength(defaultProject.panelProducts.length);
    expect(normalized.accessories).toHaveLength(defaultProject.accessories.length);
    expect(normalized.budgetAssistant).toMatchObject(defaultProject.budgetAssistant);
  });

  it("keeps every default scenario method-aware while preserving legacy aFrame inputs", () => {
    for (const scenario of defaultProject.scenarios) {
      expect(scenario.constructionMethod).toBe("aframe");
      expect(scenario.methodInputs.aframe).toMatchObject(scenario.aFrame);
    }
  });

  it("normalizes manual budget assistant data from saved projects", () => {
    const legacyProject = {
      ...defaultProject,
      budgetAssistant: undefined,
    } as unknown as Project;
    const savedProject = {
      ...defaultProject,
      budgetAssistant: {
        costSources: [
          {
            id: "source-1",
            type: "manual",
            title: "Cotacao local",
          },
        ],
        priceSources: [
          {
            id: "price-source-1",
            type: "supplier_quote",
            title: "Base regional",
          },
        ],
        costItems: [],
        matches: [
          {
            id: "manual-match-1",
            quantityItemId: "q-1",
            costItemId: "c-1",
            confidence: "low",
            reason: "Manual",
            unitCompatible: true,
            requiresReview: true,
            approvedByUser: false,
          },
        ],
      },
    } as unknown as Project;

    expect(normalizeProject(legacyProject).budgetAssistant).toMatchObject(defaultProject.budgetAssistant);
    expect(normalizeProject(savedProject).budgetAssistant.costSources[0]).toMatchObject({
      title: "Cotacao local",
      supplier: "",
      state: "",
      city: "",
      referenceDate: "",
      reliability: "low",
      notes: "",
    });
    expect(normalizeProject(savedProject).budgetAssistant.priceSources[0]).toMatchObject({
      title: "Base regional",
      supplier: "",
      state: "",
      city: "",
      referenceDate: "",
      reliability: "low",
      notes: "",
    });
    expect(normalizeProject(savedProject).budgetAssistant.matches[0].approvedByUser).toBe(true);
  });

  it("normalizes legacy projects without manual takeoff data and preserves imported manual collections", () => {
    const legacyProject = {
      ...defaultProject,
      scenarios: [
        {
          ...defaultProject.scenarios[0],
          manualTakeoff: undefined,
        },
      ],
    } as Project;
    const manualTakeoff = createManualTakeoffDataFromState(
      createDefaultManualTakeoffState({
        rooms: [
          {
            ...createDefaultManualTakeoffState().rooms[0],
            id: "room-custom",
            name: "Suite",
            areaM2: 14,
          },
        ],
      }),
      "2026-05-08T20:00:00.000Z"
    );
    const importedProject = {
      ...defaultProject,
      scenarios: [
        {
          ...defaultProject.scenarios[0],
          manualTakeoff,
        },
      ],
    } as Project;

    expect(normalizeProject(legacyProject).scenarios[0].manualTakeoff).toBeUndefined();
    expect(normalizeProject(importedProject).scenarios[0].manualTakeoff).toMatchObject({
      version: 1,
      source: "manual-stepper",
      rooms: [{ id: "room-custom", name: "Suite", areaM2: 14 }],
      openings: expect.any(Array),
      wallMetrics: expect.objectContaining({ floorHeightM: expect.any(Number) }),
      foundationRoof: expect.objectContaining({ roofType: expect.any(String) }),
      mep: expect.objectContaining({ plumbingEstimated: expect.any(Boolean) }),
    });
  });
});
