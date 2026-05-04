import type { Construction3DLayer } from "@/lib/construction-methods/types";

export function getGenericViewerFramingLayers(
  activeLayers: Construction3DLayer[],
  dimensionLayers: Construction3DLayer[],
  showDimensions: boolean
): Construction3DLayer[] {
  return showDimensions ? dimensionLayers : activeLayers;
}
