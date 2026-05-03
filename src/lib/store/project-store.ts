"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultProject } from "@/data/defaultProject";
import type {
  AFrameInputs,
  CustomMaterialProduct,
  FoundationAssumptions,
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

export type SavedProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
  city: string;
  state: string;
  scenarioCount: number;
};

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

function upsertSavedProject(savedProjects: Project[], project: Project) {
  const normalized = normalizeProject(project);
  const stamped = { ...normalized, updatedAt: new Date().toISOString() } as Project & { updatedAt: string };
  const existing = savedProjects.filter((item) => item.id !== stamped.id);
  return [stamped, ...existing].sort((a, b) => {
    const aDate = (a as Project & { updatedAt?: string }).updatedAt ?? "";
    const bDate = (b as Project & { updatedAt?: string }).updatedAt ?? "";
    return bDate.localeCompare(aDate);
  });
}

export function getSavedProjectSummary(project: Project): SavedProjectSummary {
  const scenario = project.scenarios.find((item) => item.id === project.selectedScenarioId) ?? project.scenarios[0];
  return {
    id: project.id,
    name: project.name,
    updatedAt: (project as Project & { updatedAt?: string }).updatedAt ?? "",
    city: scenario?.location.city ?? "",
    state: scenario?.location.state ?? "",
    scenarioCount: project.scenarios.length,
  };
}

interface ProjectStore {
  project: Project;
  savedProjects: Project[];
  setProject: (project: Project) => void;
  resetProject: () => void;
  saveCurrentProject: () => void;
  openSavedProject: (projectId: string) => void;
  deleteSavedProject: (projectId: string) => void;
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
  updateCustomMaterial: (materialId: string, updates: Partial<CustomMaterialProduct>) => void;
  addCustomMaterial: () => void;
  deleteCustomMaterial: (materialId: string) => void;
  updateSteelProfile: (profileId: string, updates: Partial<SteelProfile>) => void;
  addCustomPanelProduct: () => void;
  deletePanelProduct: (panelProductId: string) => void;
  updateSupplier: (supplierId: string, updates: Partial<Project["suppliers"][number]>) => void;
  addSupplier: () => void;
  deleteSupplier: (supplierId: string) => void;
  updateStructuralInputs: (updates: Partial<StructuralInputs>) => void;
  updateMaterialAssumptions: (updates: Partial<Project["materialAssumptions"]>) => void;
  updateBudgetAssumptions: (updates: Partial<Project["budgetAssumptions"]>) => void;
  updateFoundationAssumptions: (updates: Partial<FoundationAssumptions>) => void;
  setOnboardingCompleted: (completed: boolean) => void;
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
      savedProjects: [],
      setProject: (project) => set({ project: normalizeProject(project) }),
      resetProject: () => set({ project: { ...cloneProject(defaultProject), id: `project-${Date.now()}` } }),
      saveCurrentProject: () =>
        set((state) => ({
          savedProjects: upsertSavedProject(state.savedProjects, state.project),
        })),
      openSavedProject: (projectId) =>
        set((state) => {
          const saved = state.savedProjects.find((item) => item.id === projectId);
          return saved ? { project: normalizeProject(saved) } : state;
        }),
      deleteSavedProject: (projectId) =>
        set((state) => {
          const savedProjects = state.savedProjects.filter((item) => item.id !== projectId);
          if (state.project.id !== projectId) return { savedProjects };
          return {
            savedProjects,
            project: savedProjects[0] ? normalizeProject(savedProjects[0]) : { ...cloneProject(defaultProject), id: `project-${Date.now()}` },
          };
        }),
      importProject: (project) =>
        set((state) => {
          const normalized = normalizeProject(project);
          return {
            project: normalized,
            savedProjects: upsertSavedProject(state.savedProjects, normalized),
          };
        }),
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
      updateCustomMaterial: (materialId, updates) =>
        set((state) => ({
          project: {
            ...state.project,
            customMaterials: state.project.customMaterials.map((item) => (item.id === materialId ? { ...item, ...updates } : item)),
          },
        })),
      addCustomMaterial: () =>
        set((state) => ({
          project: {
            ...state.project,
            customMaterials: [
              ...state.project.customMaterials,
              {
                id: `material-${Date.now()}`,
                code: "NOVO-MATERIAL",
                description: "Novo material para orcamento",
                category: "other",
                supplier: "A confirmar",
                unit: "un",
                quantity: 1,
                lengthM: 1,
                widthM: 1,
                unitPriceBRL: undefined,
                maxLengthM: undefined,
                lengthIncrementM: 1,
                enabled: true,
                notes: "Ajustar descricao, medida, preco e fornecedor.",
              },
            ],
          },
        })),
      deleteCustomMaterial: (materialId) =>
        set((state) => ({
          project: {
            ...state.project,
            customMaterials: state.project.customMaterials.filter((item) => item.id !== materialId),
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
      updateFoundationAssumptions: (updates) =>
        set((state) => ({
          project: { ...state.project, foundationAssumptions: { ...state.project.foundationAssumptions, ...updates } },
        })),
      setOnboardingCompleted: (completed) =>
        set((state) => {
          const project = { ...state.project, onboardingCompleted: completed };
          return {
            project,
            savedProjects: completed ? upsertSavedProject(state.savedProjects, project) : state.savedProjects,
          };
        }),
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
      version: 5,
      partialize: (state) => ({ project: state.project, savedProjects: state.savedProjects }),
      migrate: (persisted) => {
        const persistedState = persisted as { project?: Project; savedProjects?: Project[] } | undefined;
        const persistedProject = persistedState?.project;
        const project = persistedProject ? normalizeProject(persistedProject) : cloneProject(defaultProject);
        const savedProjects = persistedState?.savedProjects?.length
          ? persistedState.savedProjects.map(normalizeProject)
          : project.onboardingCompleted
            ? upsertSavedProject([], project)
            : [];
        return { project, savedProjects };
      },
      merge: (persisted, current) => {
        const persistedState = persisted as { project?: Project; savedProjects?: Project[] } | undefined;
        const persistedProject = persistedState?.project;
        const project = persistedProject ? normalizeProject(persistedProject) : current.project;
        const savedProjects = persistedState?.savedProjects?.length
          ? persistedState.savedProjects.map(normalizeProject)
          : project.onboardingCompleted
            ? upsertSavedProject([], project)
            : current.savedProjects;
        return { ...current, project, savedProjects };
      },
    }
  )
);

export function useSelectedScenario() {
  const project = useProjectStore((state) => state.project);
  return project.scenarios.find((scenario) => scenario.id === project.selectedScenarioId) ?? project.scenarios[0];
}
