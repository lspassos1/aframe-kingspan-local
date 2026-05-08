import { beforeEach, describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { cloneProject } from "@/lib/store/project-normalization";
import { useProjectStore } from "@/lib/store/project-store";
import { createDefaultManualTakeoffState, createManualTakeoffDataFromState } from "@/lib/takeoff/manual-stepper";

function resetStoreForTest() {
  useProjectStore.setState({
    project: cloneProject(defaultProject),
    savedProjects: [],
    projectHydrationStatus: "loaded",
  });
}

function persistManualTakeoff() {
  const scenario = useProjectStore.getState().project.scenarios[0];
  const manualTakeoff = createManualTakeoffDataFromState(
    createDefaultManualTakeoffState({
      buildingWidthM: 9,
      buildingDepthM: 11,
      rooms: [],
      openings: [],
    }),
    "2026-05-08T20:00:00.000Z"
  );

  useProjectStore.getState().updateScenarioManualTakeoff(scenario.id, manualTakeoff);

  return { scenario, manualTakeoff };
}

function findScenario(scenarioId: string) {
  return useProjectStore.getState().project.scenarios.find((scenario) => scenario.id === scenarioId);
}

describe("project store manual takeoff invalidation", () => {
  beforeEach(() => {
    resetStoreForTest();
  });

  it("clears persisted manual takeoff when method inputs change outside the manual stepper", () => {
    const { scenario } = persistManualTakeoff();

    useProjectStore.getState().updateScenarioMethodInputs(scenario.id, scenario.constructionMethod, {
      ...scenario.methodInputs[scenario.constructionMethod],
      widthM: 12,
    });

    expect(findScenario(scenario.id)?.manualTakeoff).toBeUndefined();
  });

  it("preserves persisted manual takeoff when external method input update is a no-op", () => {
    const { scenario } = persistManualTakeoff();

    useProjectStore.getState().updateScenarioMethodInputs(scenario.id, scenario.constructionMethod, scenario.methodInputs[scenario.constructionMethod]!);

    expect(findScenario(scenario.id)?.manualTakeoff?.rooms).toEqual([]);
    expect(findScenario(scenario.id)?.manualTakeoff?.openings).toEqual([]);
  });

  it("allows the manual stepper to persist manual takeoff after geometry syncs", () => {
    const { scenario, manualTakeoff } = persistManualTakeoff();

    useProjectStore.getState().updateScenarioTerrain(scenario.id, {
      ...scenario.terrain,
      width: 18,
    });
    expect(findScenario(scenario.id)?.manualTakeoff).toBeUndefined();

    useProjectStore.getState().updateScenarioManualTakeoff(scenario.id, manualTakeoff);

    expect(findScenario(scenario.id)?.manualTakeoff?.rooms).toEqual([]);
    expect(findScenario(scenario.id)?.manualTakeoff?.openings).toEqual([]);
  });
});
