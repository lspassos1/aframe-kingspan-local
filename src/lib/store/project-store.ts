"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultProject } from "@/data/defaultProject";
import type {
  AFrameInputs,
  LocationData,
  PricingMeta,
  Project,
  Scenario,
  SteelProfile,
  StructuralInputs,
  Terrain,
} from "@/types/project";
import { duplicateScenario } from "@/lib/calculations/scenarios";

const cloneProject = (project: Project): Project => JSON.parse(JSON.stringify(project)) as Project;

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

  return {
    ...defaultScenario,
    ...scenario,
    location: { ...defaultScenario.location, ...scenario.location },
    terrain: { ...defaultScenario.terrain, ...scenario.terrain },
    pricing: { ...defaultScenario.pricing, ...scenario.pricing },
    aFrame: {
      ...defaultScenario.aFrame,
      ...scenario.aFrame,
      upperFloorMode: legacyAFrame.upperFloorMode ?? "full-floor",
      upperFloorLevelHeight: legacyAFrame.upperFloorLevelHeight ?? legacyAFrame.mezzanineFloorHeight ?? defaultScenario.aFrame.upperFloorLevelHeight,
      upperFloorAreaPercent: legacyAFrame.upperFloorAreaPercent ?? legacyMezzaninePercent,
    },
  };
}

function normalizeProject(project: Project): Project {
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
    scenarios: (project.scenarios?.length ? project.scenarios : defaults.scenarios).map(normalizeScenario),
    panelProducts,
    panelFinishes: project.panelFinishes?.length ? project.panelFinishes : defaults.panelFinishes,
    accessories: project.accessories?.length ? project.accessories : defaults.accessories,
    steelProfiles: project.steelProfiles?.length ? project.steelProfiles : defaults.steelProfiles,
    steelPriceSources: project.steelPriceSources?.length ? project.steelPriceSources : defaults.steelPriceSources,
    suppliers: project.suppliers?.length ? project.suppliers : defaults.suppliers,
    structuralInputs: { ...defaults.structuralInputs, ...project.structuralInputs },
    materialAssumptions: { ...defaults.materialAssumptions, ...project.materialAssumptions },
    budgetAssumptions: { ...defaults.budgetAssumptions, ...project.budgetAssumptions },
  };
}

interface ProjectStore {
  project: Project;
  setProject: (project: Project) => void;
  resetProject: () => void;
  selectScenario: (scenarioId: string) => void;
  updateProjectName: (name: string) => void;
  updateScenarioName: (scenarioId: string, name: string) => void;
  updateScenarioLocation: (scenarioId: string, location: LocationData) => void;
  updateScenarioTerrain: (scenarioId: string, terrain: Terrain) => void;
  updateScenarioAFrame: (scenarioId: string, aFrame: AFrameInputs) => void;
  updateScenarioPanel: (scenarioId: string, panelProductId: string, externalColor: string, internalFinish: string) => void;
  updateScenarioPricing: (scenarioId: string, pricing: PricingMeta) => void;
  updateScenarioSteelMode: (scenarioId: string, steelMode: Scenario["steelMode"]) => void;
  updatePanelProduct: (panelProductId: string, updates: Partial<Project["panelProducts"][number]>) => void;
  updateAccessory: (accessoryId: string, updates: Partial<Project["accessories"][number]>) => void;
  updateSteelProfile: (profileId: string, updates: Partial<SteelProfile>) => void;
  addCustomPanelProduct: () => void;
  deletePanelProduct: (panelProductId: string) => void;
  updateSupplier: (supplierId: string, updates: Partial<Project["suppliers"][number]>) => void;
  addSupplier: () => void;
  deleteSupplier: (supplierId: string) => void;
  updateStructuralInputs: (updates: Partial<StructuralInputs>) => void;
  updateMaterialAssumptions: (updates: Partial<Project["materialAssumptions"]>) => void;
  updateBudgetAssumptions: (updates: Partial<Project["budgetAssumptions"]>) => void;
  duplicateSelectedScenario: () => void;
  deleteScenario: (scenarioId: string) => void;
  importProject: (project: Project) => void;
}

function updateScenario(project: Project, scenarioId: string, updater: (scenario: Scenario) => Scenario): Project {
  return {
    ...project,
    scenarios: project.scenarios.map((scenario) => (scenario.id === scenarioId ? updater(scenario) : scenario)),
  };
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      project: cloneProject(defaultProject),
      setProject: (project) => set({ project: normalizeProject(project) }),
      resetProject: () => set({ project: cloneProject(defaultProject) }),
      importProject: (project) => set({ project: normalizeProject(project) }),
      selectScenario: (scenarioId) =>
        set((state) => ({
          project: { ...state.project, selectedScenarioId: scenarioId },
        })),
      updateProjectName: (name) =>
        set((state) => ({
          project: { ...state.project, name },
        })),
      updateScenarioName: (scenarioId, name) =>
        set((state) => ({
          project: updateScenario(state.project, scenarioId, (scenario) => ({ ...scenario, name })),
        })),
      updateScenarioLocation: (scenarioId, location) =>
        set((state) => ({
          project: updateScenario(state.project, scenarioId, (scenario) => ({ ...scenario, location })),
        })),
      updateScenarioTerrain: (scenarioId, terrain) =>
        set((state) => ({
          project: updateScenario(state.project, scenarioId, (scenario) => ({ ...scenario, terrain })),
        })),
      updateScenarioAFrame: (scenarioId, aFrame) =>
        set((state) => ({
          project: updateScenario(state.project, scenarioId, (scenario) => ({ ...scenario, aFrame })),
        })),
      updateScenarioPanel: (scenarioId, panelProductId, externalColor, internalFinish) =>
        set((state) => ({
          project: updateScenario(state.project, scenarioId, (scenario) => ({
            ...scenario,
            panelProductId,
            externalColor,
            internalFinish,
          })),
        })),
      updateScenarioPricing: (scenarioId, pricing) =>
        set((state) => ({
          project: updateScenario(state.project, scenarioId, (scenario) => ({ ...scenario, pricing })),
        })),
      updateScenarioSteelMode: (scenarioId, steelMode) =>
        set((state) => ({
          project: updateScenario(state.project, scenarioId, (scenario) => ({ ...scenario, steelMode })),
        })),
      updatePanelProduct: (panelProductId, updates) =>
        set((state) => ({
          project: {
            ...state.project,
            panelProducts: state.project.panelProducts.map((item) => (item.id === panelProductId ? { ...item, ...updates } : item)),
          },
        })),
      updateAccessory: (accessoryId, updates) =>
        set((state) => ({
          project: {
            ...state.project,
            accessories: state.project.accessories.map((item) => (item.id === accessoryId ? { ...item, ...updates } : item)),
          },
        })),
      updateSteelProfile: (profileId, updates) =>
        set((state) => ({
          project: {
            ...state.project,
            steelProfiles: state.project.steelProfiles.map((item) => (item.id === profileId ? { ...item, ...updates } : item)),
          },
        })),
      addCustomPanelProduct: () =>
        set((state) => {
          const id = `custom-panel-${Date.now()}`;
          return {
            project: {
              ...state.project,
              panelProducts: [
                ...state.project.panelProducts,
                {
                  id,
                  supplier: "Fornecedor customizado",
                  productName: "Novo painel customizado",
                  category: "Painel sanduiche editavel",
                  coreType: "other",
                  thicknessMm: 30,
                  lengthM: 7.5,
                  usefulWidthM: 1,
                  externalFinish: "Customizado",
                  internalFinish: "Customizado",
                  colorCode: "CUSTOM",
                  colorHex: "#8aa6a3",
                  isCustom: true,
                  notes: "Cadastrar dados recebidos do fornecedor.",
                },
              ],
            },
          };
        }),
      deletePanelProduct: (panelProductId) =>
        set((state) => {
          if (state.project.panelProducts.length <= 1) return state;
          return {
            project: {
              ...state.project,
              panelProducts: state.project.panelProducts.filter((item) => item.id !== panelProductId),
            },
          };
        }),
      updateSupplier: (supplierId, updates) =>
        set((state) => ({
          project: {
            ...state.project,
            suppliers: state.project.suppliers.map((item) => (item.id === supplierId ? { ...item, ...updates } : item)),
          },
        })),
      addSupplier: () =>
        set((state) => ({
          project: {
            ...state.project,
            suppliers: [
              ...state.project.suppliers,
              {
                id: `supplier-${Date.now()}`,
                companyName: "Novo fornecedor",
                category: "other",
                city: "",
                state: "",
                products: "",
                deliveryAvailability: "",
                notes: "",
              },
            ],
          },
        })),
      deleteSupplier: (supplierId) =>
        set((state) => ({
          project: {
            ...state.project,
            suppliers: state.project.suppliers.filter((item) => item.id !== supplierId),
          },
        })),
      updateStructuralInputs: (updates) =>
        set((state) => ({
          project: { ...state.project, structuralInputs: { ...state.project.structuralInputs, ...updates } },
        })),
      updateMaterialAssumptions: (updates) =>
        set((state) => ({
          project: { ...state.project, materialAssumptions: { ...state.project.materialAssumptions, ...updates } },
        })),
      updateBudgetAssumptions: (updates) =>
        set((state) => ({
          project: { ...state.project, budgetAssumptions: { ...state.project.budgetAssumptions, ...updates } },
        })),
      duplicateSelectedScenario: () =>
        set((state) => {
          const selected = state.project.scenarios.find((scenario) => scenario.id === state.project.selectedScenarioId);
          if (!selected) return state;
          const copy = duplicateScenario(selected);
          return {
            project: {
              ...state.project,
              scenarios: [...state.project.scenarios, copy],
              selectedScenarioId: copy.id,
            },
          };
        }),
      deleteScenario: (scenarioId) =>
        set((state) => {
          if (state.project.scenarios.length <= 1) return state;
          const scenarios = state.project.scenarios.filter((scenario) => scenario.id !== scenarioId);
          const selectedScenarioId =
            state.project.selectedScenarioId === scenarioId ? scenarios[0].id : state.project.selectedScenarioId;
          return {
            project: {
              ...state.project,
              scenarios,
              selectedScenarioId,
            },
          };
        }),
    }),
    {
      name: "aframe-project-store",
      version: 2,
      partialize: (state) => ({ project: state.project }),
      merge: (persisted, current) => {
        const persistedProject = (persisted as { project?: Project } | undefined)?.project;
        return { ...current, project: persistedProject ? normalizeProject(persistedProject) : current.project };
      },
    }
  )
);

export function useSelectedScenario() {
  const project = useProjectStore((state) => state.project);
  return project.scenarios.find((scenario) => scenario.id === project.selectedScenarioId) ?? project.scenarios[0];
}
