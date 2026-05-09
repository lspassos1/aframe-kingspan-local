import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mockAFrame = {
  panelLength: 7.5,
  panelUsefulWidth: 1,
  panelThickness: 30,
  baseAngleDeg: 50,
  houseDepth: 10,
  automaticDepth: false,
  targetGroundUsefulArea: 80,
  upperFloorMode: "none",
  upperFloorLevelHeight: 2.8,
  upperFloorAreaPercent: 100,
  floorBuildUpThickness: 0.18,
  minimumUsefulHeight: 1.5,
  ridgeCapAllowance: 0.12,
  facadeType: "mixed",
  frontOverhang: 0,
  rearOverhang: 0,
  lateralBaseFlashingOffset: 0.05,
};

const mockScenario = {
  id: "scenario-test",
  name: "Teste",
  constructionMethod: "aframe",
  methodInputs: { aframe: mockAFrame },
  terrain: {
    width: 12,
    depth: 24,
    frontSide: "width",
    frontSetback: 3,
    rearSetback: 2,
    leftSetback: 1.5,
    rightSetback: 1.5,
  },
  location: {
    address: "",
    city: "Cruz das Almas",
    state: "Bahia",
    country: "Brasil",
    postalCode: "",
    notes: "",
  },
  aFrame: mockAFrame,
  panelProductId: "panel",
  externalColor: "#fff",
  internalFinish: "#fff",
  steelMode: "optimized",
  pricing: {
    source: "",
    supplier: "",
    quoteDate: "",
    validDays: 0,
    freightBRL: 0,
    notes: "",
  },
  manualTakeoff: {
    version: 1,
    updatedAt: "2026-05-08T20:00:00.000Z",
    site: {
      projectName: "Nome antigo persistido",
    },
  },
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/store/project-store", () => ({
  useSelectedScenario: () => mockScenario,
  useProjectStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      project: { name: "Estudo manual teste" },
      updateProjectName: vi.fn(),
      updateScenarioName: vi.fn(),
      updateScenarioLocation: vi.fn(),
      updateScenarioTerrain: vi.fn(),
      updateScenarioConstructionMethod: vi.fn(),
      updateScenarioMethodInputs: vi.fn(),
      updateScenarioManualTakeoff: vi.fn(),
      updateScenarioAFrame: vi.fn(),
      setOnboardingCompleted: vi.fn(),
    }),
}));

import { ManualTakeoffStepper } from "@/components/onboarding/ManualTakeoffStepper";

describe("ManualTakeoffStepper UI", () => {
  it("renders the real manual takeoff shell with editable stages before method confirmation", () => {
    const html = renderToStaticMarkup(createElement(ManualTakeoffStepper));

    expect(html).toContain('data-testid="manual-takeoff-stepper"');
    expect(html).toContain("Takeoff por etapas");
    expect(html).toContain("Ambientes");
    expect(html).toContain("Portas e janelas");
    expect(html).toContain("Paredes");
    expect(html).toContain("Fundação e cobertura");
    expect(html).toContain("Elétrica e hidráulica");
    expect(html).toContain("Método");
    expect(html).toContain("Revisão");
    expect(html).toContain("Base de preço sugerida");
    expect(html).toContain('value="Estudo manual teste"');
    expect(html).not.toContain("Nome antigo persistido");
  });
});
