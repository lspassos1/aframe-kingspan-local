import type { Construction3DLayer, Construction3DPrimitive } from "@/lib/construction-methods/types";

export interface Construction3DExtents {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface GenericConstructionDimensions {
  footprint: Construction3DExtents;
  vertical: Construction3DExtents;
  terrain?: Construction3DExtents;
  widthM: number;
  depthM: number;
  heightM: number;
  terrainWidthM?: number;
  terrainDepthM?: number;
}

function extentsForPrimitive(primitive: Construction3DPrimitive): Construction3DExtents {
  const [x, y, z] = primitive.position;
  const [width, height, depth] = primitive.size;

  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minY: y - height / 2,
    maxY: y + height / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  };
}

function mergeExtents(primitives: Construction3DPrimitive[]): Construction3DExtents | null {
  if (primitives.length === 0) return null;

  return primitives.map(extentsForPrimitive).reduce((merged, extents) => ({
    minX: Math.min(merged.minX, extents.minX),
    maxX: Math.max(merged.maxX, extents.maxX),
    minY: Math.min(merged.minY, extents.minY),
    maxY: Math.max(merged.maxY, extents.maxY),
    minZ: Math.min(merged.minZ, extents.minZ),
    maxZ: Math.max(merged.maxZ, extents.maxZ),
  }));
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function nominalSpan(primitives: Construction3DPrimitive[], axis: 0 | 2, fallback: number) {
  if (primitives.length === 0) return fallback;

  return Math.max(...primitives.map((primitive) => primitive.size[axis]));
}

export function getGenericConstructionDimensions(layers: Construction3DLayer[]): GenericConstructionDimensions | null {
  const terrain = mergeExtents(layers.filter((layer) => layer.type === "terrain").flatMap((layer) => layer.data.primitives));
  const wallPrimitives = layers.filter((layer) => layer.type === "walls").flatMap((layer) => layer.data.primitives);
  const nonTerrainPrimitives = layers
    .filter((layer) => layer.type !== "terrain" && layer.type !== "dimensions" && layer.type !== "warnings")
    .flatMap((layer) => layer.data.primitives);
  const footprint = mergeExtents(wallPrimitives.length > 0 ? wallPrimitives : nonTerrainPrimitives);
  const vertical = mergeExtents(nonTerrainPrimitives);

  if (!footprint || !vertical) return null;

  return {
    footprint,
    vertical,
    terrain: terrain ?? undefined,
    widthM: round(nominalSpan(wallPrimitives, 0, footprint.maxX - footprint.minX)),
    depthM: round(nominalSpan(wallPrimitives, 2, footprint.maxZ - footprint.minZ)),
    heightM: round(vertical.maxY),
    terrainWidthM: terrain ? round(terrain.maxX - terrain.minX) : undefined,
    terrainDepthM: terrain ? round(terrain.maxZ - terrain.minZ) : undefined,
  };
}
