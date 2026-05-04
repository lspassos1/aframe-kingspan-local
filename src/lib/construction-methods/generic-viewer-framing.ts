import type { Construction3DLayer, Construction3DPrimitive, Construction3DVector3 } from "@/lib/construction-methods/types";
import type { Construction3DExtents } from "@/lib/construction-methods/three-dimensions";
import { getGenericConstructionDimensions } from "@/lib/construction-methods/three-dimensions";

function primitiveFromExtents(id: string, extents: Construction3DExtents, color: string): Construction3DPrimitive {
  const size: Construction3DVector3 = [
    Math.max(0.01, extents.maxX - extents.minX),
    Math.max(0.01, extents.maxY - extents.minY),
    Math.max(0.01, extents.maxZ - extents.minZ),
  ];
  const position: Construction3DVector3 = [
    (extents.minX + extents.maxX) / 2,
    (extents.minY + extents.maxY) / 2,
    (extents.minZ + extents.maxZ) / 2,
  ];

  return {
    id,
    kind: "box",
    position,
    size,
    color,
    opacity: 0,
  };
}

export function getGenericViewerFramingLayers(
  activeLayers: Construction3DLayer[],
  showDimensions: boolean
): Construction3DLayer[] {
  if (!showDimensions) return activeLayers;

  const dimensions = getGenericConstructionDimensions(activeLayers);
  const methodId = activeLayers[0]?.methodId;

  if (!dimensions || !methodId) return activeLayers;

  const dimensionFramingLayers: Construction3DLayer[] = [
    {
      id: "dimension-overlay-building-framing",
      type: "structure",
      label: "Enquadramento cotas da casa",
      visibleByDefault: true,
      methodId,
      data: {
        primitives: [
          primitiveFromExtents(
            "dimension-building-bounds",
            {
              minX: dimensions.footprint.minX,
              maxX: dimensions.footprint.maxX,
              minY: 0,
              maxY: dimensions.vertical.maxY,
              minZ: dimensions.footprint.minZ,
              maxZ: dimensions.footprint.maxZ,
            },
            "#334155"
          ),
        ],
      },
    },
  ];

  if (dimensions.terrain) {
    dimensionFramingLayers.push({
      id: "dimension-overlay-terrain-framing",
      type: "terrain",
      label: "Enquadramento cotas do lote",
      visibleByDefault: true,
      methodId,
      data: {
        primitives: [primitiveFromExtents("dimension-terrain-bounds", dimensions.terrain, "#0f766e")],
      },
    });
  }

  return [...activeLayers, ...dimensionFramingLayers];
}
