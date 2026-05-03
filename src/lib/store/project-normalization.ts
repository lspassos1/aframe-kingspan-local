import { defaultProject } from "@/data/defaultProject";
import { constructionMethodRegistry, getConstructionMethodDefinition, type ConstructionMethodId } from "@/lib/construction-methods";
import type { AFrameInputs, Project, Scenario, ScenarioMethodInputs } from "@/types/project";

export const cloneProject = (project: Project): Project => JSON.parse(JSON.stringify(project)) as Project;

type LegacyAFrameInputs = Partial<AFrameInputs> & {
  mezzanineFloorHeight?: number;
  mezzanineDepth?: number;
};

function normalizeScenario(scenario: Scenario): Scenario {
  const defaultScenario = defaultProject.scenarios[0];
  const legacyAFrame = scenario.aFrame as LegacyAFrameInputs;
  const houseDepth = legacyAFrame.houseDepth ?? defaultScenario.aFrame.houseDepth;
  const legacyMezzaninePercent =
    legacyAFrame.mezzanineDepth && houseDepth > 0 ? Math.min(100, Math.max(0, (legacyAFrame.mezzanineDepth / houseDepth) * 100)) : 100;
  const normalizedAFrame = {
    ...defaultScenario.aFrame,
    ...scenario.aFrame,
    upperFloorMode: legacyAFrame.upperFloorMode ?? "full-floor",
    upperFloorLevelHeight: legacyAFrame.upperFloorLevelHeight ?? legacyAFrame.mezzanineFloorHeight ?? defaultScenario.aFrame.upperFloorLevelHeight,
    upperFloorAreaPercent: legacyAFrame.upperFloorAreaPercent ?? legacyMezzaninePercent,
  };
  const candidateMethod = scenario.constructionMethod;
  const constructionMethod: ConstructionMethodId =
    candidateMethod && constructionMethodRegistry[candidateMethod] ? candidateMethod : "aframe";
  const existingMethodInputs = scenario.methodInputs ?? {};
  const methodInputs: ScenarioMethodInputs = {
    ...existingMethodInputs,
    aframe: normalizedAFrame,
  };

  if (constructionMethod !== "aframe" && !methodInputs[constructionMethod]) {
    methodInputs[constructionMethod] = getConstructionMethodDefinition(constructionMethod).getDefaultInputs();
  }

  return {
    ...defaultScenario,
    ...scenario,
    constructionMethod,
    methodInputs,
    location: { ...defaultScenario.location, ...scenario.location },
    terrain: { ...defaultScenario.terrain, ...scenario.terrain },
    pricing: { ...defaultScenario.pricing, ...scenario.pricing },
    aFrame: normalizedAFrame,
  };
}

export function normalizeProject(project: Project): Project {
  const defaults = cloneProject(defaultProject);
  const defaultPanelsById = new Map(defaults.panelProducts.map((panel) => [panel.id, panel]));
  const importedPanels = project.panelProducts?.length ? project.panelProducts : defaults.panelProducts;
  const panelProducts = importedPanels.map((panel) => {
    const baseline = defaultPanelsById.get(panel.id);
    return baseline ? { ...baseline, ...panel, isCustom: panel.isCustom ?? baseline.isCustom } : panel;
  });

  return {
    ...defaults,
    ...project,
    onboardingCompleted: project.onboardingCompleted ?? defaults.onboardingCompleted,
    scenarios: (project.scenarios?.length ? project.scenarios : defaults.scenarios).map(normalizeScenario),
    panelProducts,
    panelFinishes: project.panelFinishes?.length ? project.panelFinishes : defaults.panelFinishes,
    accessories: project.accessories?.length ? project.accessories : defaults.accessories,
    steelProfiles: project.steelProfiles?.length ? project.steelProfiles : defaults.steelProfiles,
    steelPriceSources: project.steelPriceSources?.length ? project.steelPriceSources : defaults.steelPriceSources,
    customMaterials: project.customMaterials?.length ? project.customMaterials : defaults.customMaterials,
    suppliers: project.suppliers?.length ? project.suppliers : defaults.suppliers,
    structuralInputs: { ...defaults.structuralInputs, ...project.structuralInputs },
    materialAssumptions: { ...defaults.materialAssumptions, ...project.materialAssumptions },
    budgetAssumptions: { ...defaults.budgetAssumptions, ...project.budgetAssumptions },
    foundationAssumptions: { ...defaults.foundationAssumptions, ...project.foundationAssumptions },
  };
}

export function upsertSavedProject(savedProjects: Project[], project: Project) {
  const normalized = normalizeProject(project);
  const stamped = { ...normalized, updatedAt: new Date().toISOString() } as Project & { updatedAt: string };
  const existing = savedProjects.filter((item) => item.id !== stamped.id);
  return [stamped, ...existing].sort((a, b) => {
    const aDate = (a as Project & { updatedAt?: string }).updatedAt ?? "";
    const bDate = (b as Project & { updatedAt?: string }).updatedAt ?? "";
    return bDate.localeCompare(aDate);
  });
}
