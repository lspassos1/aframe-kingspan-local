import { describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { createAFrameMobile3DSummary, createGenericMobile3DSummary } from "@/lib/model-3d/mobile-summary";
import { createDefaultManualTakeoffState, createManualTakeoffDataFromState } from "@/lib/takeoff/manual-stepper";

describe("mobile 3D summary", () => {
  it("summarizes the A-frame model around volume, height and terrain", () => {
    const summary = createAFrameMobile3DSummary(defaultProject.scenarios[0]);

    expect(summary.map((item) => item.label)).toEqual(["Volume", "Altura", "Lote"]);
    expect(summary[0].value).toContain("x");
    expect(summary[1].detail).toBe("cumeeira preliminar");
    expect(summary[2].detail).toBe("terreno e recuos");
  });

  it("summarizes generic construction layers for the mobile-first viewer", () => {
    const definition = getConstructionMethodDefinition("conventional-masonry");
    const scenario = {
      ...defaultProject.scenarios[0],
      constructionMethod: "conventional-masonry" as const,
      methodInputs: {
        ...defaultProject.scenarios[0].methodInputs,
        "conventional-masonry": {
          ...definition.getDefaultInputs(),
          widthM: 9,
          depthM: 11,
          floorHeightM: 3,
        },
      },
    };
    const layers = definition.generate3DLayers?.({ project: defaultProject, scenario }) ?? [];
    const summary = createGenericMobile3DSummary(layers);

    expect(summary.map((item) => item.label)).toEqual(["Volume", "Altura", "Lote", "Aberturas"]);
    expect(summary[0]).toMatchObject({ value: "9,14 m x 11,14 m", detail: "largura x profundidade" });
    expect(summary[1]).toMatchObject({ value: "3,46 m", detail: "altura do modelo" });
    expect(summary[3]).toMatchObject({ value: "1 porta · 1 janela", detail: "Aberturas simplificadas para leitura volumetrica inicial." });
  });

  it("uses uncapped manual opening totals in the mobile summary", () => {
    const definition = getConstructionMethodDefinition("conventional-masonry");
    const manualState = createDefaultManualTakeoffState();
    const scenario = {
      ...defaultProject.scenarios[0],
      constructionMethod: "conventional-masonry" as const,
      manualTakeoff: createManualTakeoffDataFromState(
        {
          ...manualState,
          openings: [{ ...manualState.openings[0], kind: "door" as const, quantity: 18, wallSide: "front" as const, offsetM: 1.2 }],
        },
        "2026-05-09T00:00:00.000Z"
      ),
      methodInputs: {
        ...defaultProject.scenarios[0].methodInputs,
        "conventional-masonry": {
          ...definition.getDefaultInputs(),
          widthM: 9,
          depthM: 11,
          floorHeightM: 3,
        },
      },
    };
    const layers = definition.generate3DLayers?.({ project: defaultProject, scenario }) ?? [];
    const openingsLayer = layers.find((layer) => layer.type === "openings");
    const summary = createGenericMobile3DSummary(layers);

    expect(openingsLayer?.data.primitives).toHaveLength(12);
    expect(summary.find((item) => item.label === "Aberturas")).toMatchObject({
      value: "18 portas · 0 janelas",
      detail: "Aberturas manuais posicionadas de forma aproximada por parede e afastamento; validar em projeto tecnico.",
    });
  });
});
