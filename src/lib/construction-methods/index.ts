import { aframeDefinition } from "@/lib/construction-methods/aframe/definition";
import { conventionalMasonryDefinition } from "@/lib/construction-methods/conventional-masonry/definition";
import { ecoBlockDefinition } from "@/lib/construction-methods/eco-block/definition";
import { monolithicEpsDefinition } from "@/lib/construction-methods/monolithic-eps/definition";
import type { ConstructionMethodDefinition, ConstructionMethodId } from "@/lib/construction-methods/types";

export * from "@/lib/construction-methods/types";

export const constructionMethodDefinitions = [
  aframeDefinition,
  conventionalMasonryDefinition,
  ecoBlockDefinition,
  monolithicEpsDefinition,
] as const satisfies readonly ConstructionMethodDefinition[];

export const constructionMethodRegistry: Record<ConstructionMethodId, ConstructionMethodDefinition> = {
  aframe: aframeDefinition,
  "conventional-masonry": conventionalMasonryDefinition,
  "eco-block": ecoBlockDefinition,
  "monolithic-eps": monolithicEpsDefinition,
};

export const constructionMethodIds = constructionMethodDefinitions.map((definition) => definition.id);

export function getConstructionMethodDefinition(methodId: ConstructionMethodId) {
  return constructionMethodRegistry[methodId];
}
