import { generateRectangularConstructionLayers } from "@/lib/construction-methods/generic-three-layers";
import type { ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";

export function generateMonolithicEps3DLayers({ scenario }: ConstructionMethodCalculationContext) {
  return generateRectangularConstructionLayers("monolithic-eps", scenario, scenario.methodInputs?.["monolithic-eps"], {
    wallColor: "#e0f2fe",
    roofColor: "#334155",
    foundationColor: "#94a3b8",
    floorColor: "#cbd5e1",
  });
}
