import { generateRectangularConstructionLayers } from "@/lib/construction-methods/generic-three-layers";
import type { Construction3DLayer, Construction3DPrimitive, ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";
import { normalizeEcoBlockInputs } from "./inputs";

export function generateEcoBlock3DLayers({ scenario }: ConstructionMethodCalculationContext): Construction3DLayer[] {
  const inputs = normalizeEcoBlockInputs(scenario.methodInputs?.["eco-block"]);
  const baseLayers = generateRectangularConstructionLayers("eco-block", scenario, inputs, {
    wallColor: "#b08d57",
    roofColor: "#52525b",
    foundationColor: "#78716c",
    floorColor: "#d4d4d8",
  });
  const courseCount = Math.min(24, Math.max(4, Math.floor(inputs.floorHeightM / inputs.blockHeightM)));
  const frontZ = -inputs.depthM / 2 - inputs.blockWidthM / 2 - 0.015;
  const rearZ = inputs.depthM / 2 + inputs.blockWidthM / 2 + 0.015;
  const primitives: Construction3DPrimitive[] = Array.from({ length: courseCount }).flatMap((_, index) => {
    const y = 0.32 + index * inputs.blockHeightM;
    return [
      {
        id: `front-course-${index}`,
        kind: "box",
        position: [0, y, frontZ],
        size: [inputs.widthM, 0.012, 0.018],
        color: "#5b4636",
        opacity: 0.72,
      },
      {
        id: `rear-course-${index}`,
        kind: "box",
        position: [0, y, rearZ],
        size: [inputs.widthM, 0.012, 0.018],
        color: "#5b4636",
        opacity: 0.72,
      },
    ];
  });

  if (inputs.horizontalRebarEnabled) {
    primitives.push({
      id: "channel-belt",
      kind: "box",
      label: "Canaleta",
      position: [0, inputs.floorHeightM + 0.14, frontZ],
      size: [inputs.widthM, 0.08, 0.035],
      color: "#78350f",
      opacity: 0.78,
    });
  }

  return [
    ...baseLayers,
    {
      id: "eco-block-courses",
      type: "assembly-step",
      label: "Fiadas e canaletas",
      visibleByDefault: true,
      methodId: "eco-block",
      data: {
        primitives,
        notes: ["Linhas de fiadas simplificadas; modulacao real depende da planta e do bloco escolhido."],
      },
    },
  ];
}
