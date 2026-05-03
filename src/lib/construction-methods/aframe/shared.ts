import type { AFrameInputs, Project, Scenario } from "@/types/project";

export interface AFrameMethodContext {
  project: Project;
  scenario: Scenario;
}

export function getAFrameMethodInputs(scenario: Scenario): AFrameInputs {
  return scenario.methodInputs?.aframe ?? scenario.aFrame;
}

export function createAFrameScenarioForCalculation(scenario: Scenario): Scenario {
  const aFrame = getAFrameMethodInputs(scenario);

  return scenario.aFrame === aFrame ? scenario : { ...scenario, aFrame };
}
