import { generateRectangularConstructionLayers } from "@/lib/construction-methods/generic-three-layers";
import type { Construction3DLayer, ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";
import { normalizeMonolithicEpsInputs } from "./inputs";

export function generateMonolithicEps3DLayers({ scenario }: ConstructionMethodCalculationContext): Construction3DLayer[] {
  const inputs = normalizeMonolithicEpsInputs(scenario.methodInputs?.["monolithic-eps"]);
  const baseLayers = generateRectangularConstructionLayers("monolithic-eps", scenario, inputs, {
    wallColor: "#e0f2fe",
    roofColor: "#334155",
    foundationColor: "#94a3b8",
    floorColor: "#cbd5e1",
  });

  return [
    ...baseLayers,
    {
      id: "eps-layer-stack",
      type: "assembly-step",
      label: "EPS, malha e revestimento",
      visibleByDefault: true,
      methodId: "monolithic-eps",
      data: {
        primitives: [
          {
            id: "eps-core-front",
            kind: "box",
            label: "EPS",
            position: [0, inputs.floorHeightM / 2 + 0.24, -inputs.depthM / 2 - 0.08],
            size: [inputs.widthM, inputs.floorHeightM, 0.04],
            color: "#bae6fd",
            opacity: 0.68,
          },
          {
            id: "eps-mesh-front",
            kind: "box",
            label: "Malha",
            position: [0, inputs.floorHeightM / 2 + 0.24, -inputs.depthM / 2 - 0.125],
            size: [inputs.widthM, inputs.floorHeightM, 0.015],
            color: "#0f172a",
            opacity: 0.46,
            wireframe: true,
          },
          {
            id: "eps-render-front",
            kind: "box",
            label: "Revest.",
            position: [0, inputs.floorHeightM / 2 + 0.24, -inputs.depthM / 2 - 0.17],
            size: [inputs.widthM, inputs.floorHeightM, 0.035],
            color: "#f8fafc",
            opacity: 0.52,
          },
        ],
        notes: ["Camadas frontais simplificadas para leitura de montagem; detalhes reais dependem do fornecedor."],
      },
    },
  ];
}
