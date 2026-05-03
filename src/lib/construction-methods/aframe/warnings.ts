import type { AppWarning } from "@/types/project";
import { calculateAFrameMethodBudget } from "./budget";
import type { AFrameMethodContext } from "./shared";

export function calculateAFrameMethodWarnings(context: AFrameMethodContext): AppWarning[] {
  return calculateAFrameMethodBudget(context).warnings;
}
