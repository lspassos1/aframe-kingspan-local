import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import type { Construction3DLayer } from "@/lib/construction-methods";
import { getGenericConstructionDimensions } from "@/lib/construction-methods/three-dimensions";
import type { Scenario } from "@/types/project";

export interface Mobile3DSummaryItem {
  label: string;
  value: string;
  detail: string;
}

const br = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function meters(value: number) {
  return `${br.format(value)} m`;
}

function footprint(width: number, depth: number) {
  return `${meters(width)} x ${meters(depth)}`;
}

export function createAFrameMobile3DSummary(scenario: Scenario): Mobile3DSummaryItem[] {
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);

  return [
    {
      label: "Volume",
      value: footprint(geometry.baseWidth, geometry.effectiveHouseDepth),
      detail: "largura x profundidade",
    },
    {
      label: "Altura",
      value: meters(geometry.ridgeHeight),
      detail: "cumeeira preliminar",
    },
    {
      label: "Lote",
      value: footprint(scenario.terrain.width, scenario.terrain.depth),
      detail: "terreno e recuos",
    },
  ];
}

export function createGenericMobile3DSummary(layers: Construction3DLayer[]): Mobile3DSummaryItem[] {
  const dimensions = getGenericConstructionDimensions(layers);
  if (!dimensions) return [];

  const openingLayer = layers.find((layer) => layer.type === "openings");
  const openingPrimitives = openingLayer?.data.primitives ?? [];
  const doorCount = openingLayer?.data.openingTotals?.doorCount ?? openingPrimitives.filter((primitive) => primitive.label === "Porta" || primitive.id.includes("door")).length;
  const windowCount =
    openingLayer?.data.openingTotals?.windowCount ?? openingPrimitives.filter((primitive) => primitive.label === "Janela" || primitive.id.includes("window")).length;
  const openingCount = doorCount + windowCount;

  return [
    {
      label: "Volume",
      value: footprint(dimensions.widthM, dimensions.depthM),
      detail: "largura x profundidade",
    },
    {
      label: "Altura",
      value: meters(dimensions.heightM),
      detail: "altura do modelo",
    },
    ...(dimensions.terrainWidthM != null && dimensions.terrainDepthM != null
      ? [
          {
            label: "Lote",
            value: footprint(dimensions.terrainWidthM, dimensions.terrainDepthM),
            detail: "terreno e recuos",
          },
        ]
      : []),
    ...(openingCount > 0
      ? [
          {
            label: "Aberturas",
            value: `${doorCount} porta${doorCount === 1 ? "" : "s"} · ${windowCount} janela${windowCount === 1 ? "" : "s"}`,
            detail: openingLayer?.data.notes?.[0] ?? "posicionamento aproximado",
          },
        ]
      : []),
  ];
}
