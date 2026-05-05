import type { ConstructionMethodDefinition, ConstructionMethodId } from "@/lib/construction-methods";

export type MethodSelectorCardCopy = {
  id: ConstructionMethodId;
  displayName: string;
  visibleDescription: string;
  chips: [string, string];
};

const methodSelectorCopy: Record<ConstructionMethodId, Omit<MethodSelectorCardCopy, "id">> = {
  aframe: {
    displayName: "A-frame",
    visibleDescription: "Cabanas e volumes inclinados.",
    chips: ["Rápido", "Industrializado"],
  },
  "conventional-masonry": {
    displayName: "Alvenaria",
    visibleDescription: "Casa tradicional em blocos.",
    chips: ["Popular", "Base regional"],
  },
  "eco-block": {
    displayName: "Solo-cimento",
    visibleDescription: "Bloco modular com menos revestimento.",
    chips: ["Modular", "Econômico"],
  },
  "monolithic-eps": {
    displayName: "EPS",
    visibleDescription: "Painéis monolíticos com execução rápida.",
    chips: ["Industrializado", "Especializado"],
  },
};

export function getMethodSelectorCardCopy(definition: ConstructionMethodDefinition): MethodSelectorCardCopy {
  return {
    id: definition.id,
    ...methodSelectorCopy[definition.id],
  };
}
