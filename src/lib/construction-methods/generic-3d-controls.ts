import type { ConstructionMethodId, ConstructionMethodInputs } from "@/lib/construction-methods/types";

export interface Generic3DNumberControl {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
}

interface Generic3DControlTemplate {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  fallback: number;
}

const commonControls: Generic3DControlTemplate[] = [
  { key: "widthM", label: "Largura casa", min: 3, max: 24, step: 0.1, unit: "m", fallback: 8 },
  { key: "depthM", label: "Prof. casa", min: 3, max: 30, step: 0.1, unit: "m", fallback: 12 },
  { key: "floorHeightM", label: "Pe-direito", min: 2.2, max: 4.5, step: 0.05, unit: "m", fallback: 2.8 },
];

const methodControls: Partial<Record<ConstructionMethodId, Generic3DControlTemplate[]>> = {
  "conventional-masonry": [
    { key: "floors", label: "Pavimentos", min: 1, max: 4, step: 1, fallback: 1 },
    { key: "wallThicknessM", label: "Esp. parede", min: 0.09, max: 0.3, step: 0.01, unit: "m", fallback: 0.14 },
  ],
  "eco-block": [
    { key: "blockWidthM", label: "Esp. bloco", min: 0.08, max: 0.25, step: 0.005, unit: "m", fallback: 0.125 },
    { key: "blockHeightM", label: "Altura bloco", min: 0.08, max: 0.25, step: 0.005, unit: "m", fallback: 0.125 },
  ],
  "monolithic-eps": [
    { key: "finalWallThicknessM", label: "Esp. final parede", min: 0.08, max: 0.28, step: 0.005, unit: "m", fallback: 0.14 },
    { key: "epsCoreThicknessM", label: "Nucleo EPS", min: 0.04, max: 0.2, step: 0.005, unit: "m", fallback: 0.08 },
    { key: "renderThicknessPerFaceM", label: "Revest. por face", min: 0.015, max: 0.06, step: 0.005, unit: "m", fallback: 0.03 },
  ],
};

function readControlValue(inputs: ConstructionMethodInputs, template: Generic3DControlTemplate) {
  const value = (inputs as Record<string, unknown>)[template.key];
  return typeof value === "number" && Number.isFinite(value) ? value : template.fallback;
}

export function getGeneric3DNumberControls(methodId: ConstructionMethodId, inputs: ConstructionMethodInputs): Generic3DNumberControl[] {
  return [...commonControls, ...(methodControls[methodId] ?? [])].map((template) => ({
    ...template,
    value: readControlValue(inputs, template),
  }));
}
