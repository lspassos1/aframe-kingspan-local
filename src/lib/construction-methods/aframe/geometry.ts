import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import type { AFrameGeometry } from "@/types/project";
import { getAFrameMethodInputs, type AFrameMethodContext } from "./shared";

export function calculateAFrameMethodGeometry({ scenario }: AFrameMethodContext): AFrameGeometry {
  return calculateAFrameGeometry(scenario.terrain, getAFrameMethodInputs(scenario));
}
