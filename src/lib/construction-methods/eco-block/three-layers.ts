import { generateRectangularConstructionLayers } from "@/lib/construction-methods/generic-three-layers";
import type { ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";

export function generateEcoBlock3DLayers({ scenario }: ConstructionMethodCalculationContext) {
  return generateRectangularConstructionLayers("eco-block", scenario, scenario.methodInputs?.["eco-block"], {
    wallColor: "#b08d57",
    roofColor: "#52525b",
    foundationColor: "#78716c",
    floorColor: "#d4d4d8",
  });
}
