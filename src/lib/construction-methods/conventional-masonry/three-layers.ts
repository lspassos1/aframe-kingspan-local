import { generateRectangularConstructionLayers } from "@/lib/construction-methods/generic-three-layers";
import type { ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";

export function generateConventionalMasonry3DLayers({ scenario }: ConstructionMethodCalculationContext) {
  return generateRectangularConstructionLayers("conventional-masonry", scenario, scenario.methodInputs?.["conventional-masonry"], {
    wallColor: "#c08457",
    roofColor: "#64748b",
    foundationColor: "#a8a29e",
    floorColor: "#d6d3d1",
  });
}
