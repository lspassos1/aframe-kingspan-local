import type { AFrameGeometry, CustomMaterialProduct, MaterialLine, PanelProduct, Project, Scenario } from "@/types/project";
import { calculateAFrameGeometry } from "./geometry";

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const money = (value?: number) => (typeof value === "number" ? value : 0);

function line(input: Omit<MaterialLine, "grossTotalBRL" | "netTotalBRL">): MaterialLine {
  const grossTotalBRL = round(input.quantity * money(input.unitPriceBRL));
  const netTotalBRL = round(grossTotalBRL - input.discountBRL);
  return {
    ...input,
    grossTotalBRL,
    netTotalBRL,
  };
}

export interface PanelLayout {
  panelsPerSlope: number;
  totalPanels: number;
  segmentsPerPanel: number;
  requiredPanelLengthM: number;
  panelSegmentLengthM: number;
  panelMaxLengthM?: number;
  panelLengthExceeded: boolean;
  panelAreaM2: number;
  totalPanelAreaM2: number;
  roofInclinedAreaM2: number;
  coverageDepthM: number;
  wasteAreaM2: number;
  warnings: string[];
}

function maxPanelLength(panel: PanelProduct) {
  if (panel.maxLengthM) return panel.maxLengthM;
  if (panel.allowedLengthsM?.length) return Math.max(...panel.allowedLengthsM);
  return undefined;
}

export function splitLengthByAvailability(requiredLengthM: number, maxLengthM?: number, incrementM = 1) {
  if (!maxLengthM || requiredLengthM <= maxLengthM) {
    return {
      segments: 1,
      segmentLengthM: round(requiredLengthM),
      totalPurchaseLengthM: round(requiredLengthM),
      exceeded: false,
    };
  }

  let segments = Math.max(1, Math.ceil(requiredLengthM / maxLengthM));
  let segmentLengthM = Math.ceil(requiredLengthM / segments / incrementM) * incrementM;
  while (segmentLengthM > maxLengthM) {
    segments += 1;
    segmentLengthM = Math.ceil(requiredLengthM / segments / incrementM) * incrementM;
  }

  return {
    segments,
    segmentLengthM: round(segmentLengthM),
    totalPurchaseLengthM: round(segmentLengthM * segments),
    exceeded: true,
  };
}

export function calculatePanelLayout(
  scenario: Scenario,
  geometry: AFrameGeometry,
  panel: PanelProduct,
  sparePanels: number
): PanelLayout {
  const panelMaxLengthM = maxPanelLength(panel);
  const split = splitLengthByAvailability(scenario.aFrame.panelLength, panelMaxLengthM, panel.lengthStepM ?? 1);
  const panelsPerSlope = Math.ceil(geometry.effectiveHouseDepth / scenario.aFrame.panelUsefulWidth);
  const totalPanels = panelsPerSlope * 2 * split.segments + sparePanels;
  const panelAreaM2 = split.segmentLengthM * scenario.aFrame.panelUsefulWidth;
  const totalPanelAreaM2 = totalPanels * panelAreaM2;
  const coverageDepthM = panelsPerSlope * scenario.aFrame.panelUsefulWidth;
  const warnings = split.exceeded
    ? [
        `Comprimento requerido ${scenario.aFrame.panelLength.toFixed(2)} m excede o maximo do painel (${panelMaxLengthM?.toFixed(
          2
        )} m). Compra preliminar dividida em ${split.segments} pecas de ${split.segmentLengthM.toFixed(2)} m, em multiplos de ${
          panel.lengthStepM ?? 1
        } m.`,
      ]
    : [];

  return {
    panelsPerSlope,
    totalPanels,
    segmentsPerPanel: split.segments,
    requiredPanelLengthM: round(scenario.aFrame.panelLength),
    panelSegmentLengthM: split.segmentLengthM,
    panelMaxLengthM,
    panelLengthExceeded: split.exceeded,
    panelAreaM2: round(panelAreaM2),
    totalPanelAreaM2: round(totalPanelAreaM2),
    roofInclinedAreaM2: geometry.roofInclinedArea,
    coverageDepthM: round(coverageDepthM),
    wasteAreaM2: round(Math.max(0, totalPanelAreaM2 - geometry.roofInclinedArea)),
    warnings,
  };
}

function customMaterialQuantity(item: CustomMaterialProduct) {
  const split = splitLengthByAvailability(item.lengthM ?? 0, item.maxLengthM, item.lengthIncrementM ?? 1);
  const baseQuantity = item.quantity || 0;
  const totalLengthM = split.totalPurchaseLengthM || item.lengthM || 0;
  const widthM = item.widthM || 1;
  const quantity =
    item.unit === "m2"
      ? baseQuantity * totalLengthM * widthM
      : item.unit === "m"
        ? baseQuantity * totalLengthM
        : item.unit === "un"
          ? baseQuantity * split.segments
          : baseQuantity;

  return {
    quantity: round(quantity),
    split,
  };
}

export function calculateMaterialList(project: Project, scenario: Scenario): MaterialLine[] {
  const panel = project.panelProducts.find((item) => item.id === scenario.panelProductId) ?? project.panelProducts[0];
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const layout = calculatePanelLayout(scenario, geometry, panel, project.materialAssumptions.sparePanelCount);
  const accessoryById = Object.fromEntries(project.accessories.map((item) => [item.id, item]));
  const panelUnitPrice = panel.pricePerPanelBRL;
  const panelGross = round(layout.totalPanels * money(panelUnitPrice));
  const panelDiscount = 0;

  const materialLines: MaterialLine[] = [
    {
      id: "panels",
      code: panel.productName,
      description: `${panel.productName} - ${scenario.aFrame.panelThickness} mm - ${scenario.aFrame.panelLength.toFixed(2)} m x ${scenario.aFrame.panelUsefulWidth.toFixed(2)} m`,
      category: "panels",
      supplier: panel.supplier,
      quantity: layout.totalPanels,
      unit: "un",
      unitPriceBRL: panelUnitPrice,
      grossTotalBRL: panelGross,
      discountBRL: panelDiscount,
      netTotalBRL: round(panelGross - panelDiscount),
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: !panelUnitPrice,
      notes: `${layout.panelsPerSlope} linhas por agua, ${layout.segmentsPerPanel} segmento(s) no sentido da inclinacao. Area total de paineis: ${
        layout.totalPanelAreaM2
      } m2.${layout.warnings.length ? ` ${layout.warnings.join(" ")}` : ""}`,
    },
  ];

  const stitching = accessoryById["par-costura"];
  materialLines.push(
    line({
      id: "par-costura",
      code: stitching.code,
      description: stitching.description,
      category: "fasteners",
      supplier: stitching.supplier,
      quantity: Math.ceil(layout.totalPanels * project.materialAssumptions.screwsPerPanel),
      unit: "un",
      unitPriceBRL: stitching.unitPriceBRL,
      discountBRL: 0,
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: false,
      notes: "Quantidade escalada a partir da cotacao real de 1020 un para 36 paineis.",
    })
  );

  const fixing = accessoryById["par-fix"];
  materialLines.push(
    line({
      id: "par-fix",
      code: fixing.code,
      description: fixing.description,
      category: "fasteners",
      supplier: fixing.supplier,
      quantity: Math.ceil(layout.totalPanels * project.materialAssumptions.fixingScrewsPerPanel),
      unit: "un",
      unitPriceBRL: fixing.unitPriceBRL,
      discountBRL: 0,
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: false,
      notes: "Quantidade preliminar por painel. Confirmar linhas de fixacao com fornecedor/engenheiro.",
    })
  );

  const frontFlashing = accessoryById["acab-frontal"];
  materialLines.push(
    line({
      id: "acab-frontal",
      code: frontFlashing.code,
      description: frontFlashing.description,
      category: "flashings",
      supplier: frontFlashing.supplier,
      quantity: layout.totalPanels,
      unit: "m",
      unitPriceBRL: frontFlashing.unitPriceBRL,
      discountBRL: 0,
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: false,
      notes: "Quantidade seed usa 1 m por painel, conforme formato da cotacao KingRoofing.",
    })
  );

  const rivets = accessoryById["rebite-pop"];
  materialLines.push(
    line({
      id: "rebite-pop",
      code: rivets.code,
      description: rivets.description,
      category: "fasteners",
      supplier: rivets.supplier,
      quantity: Math.ceil((layout.totalPanels / 36) * 7),
      unit: "package",
      unitPriceBRL: rivets.unitPriceBRL,
      discountBRL: 0,
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: false,
      notes: "Pacotes de 100 unidades, escalados pela quantidade de paineis.",
    })
  );

  const ridge = accessoryById["cumeeira-trap"];
  materialLines.push(
    line({
      id: "cumeeira-trap",
      code: ridge.code,
      description: ridge.description,
      category: "flashings",
      supplier: ridge.supplier,
      quantity: Math.ceil(geometry.effectiveHouseDepth / (ridge.pieceLengthM ?? 1)),
      unit: "un",
      unitPriceBRL: ridge.unitPriceBRL,
      discountBRL: 0,
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: false,
      notes: "Cumeeira ao longo da profundidade da casa.",
    })
  );

  const internal = accessoryById["acab-interno"];
  materialLines.push(
    line({
      id: "acab-interno",
      code: internal.code,
      description: internal.description,
      category: "flashings",
      supplier: internal.supplier,
      quantity: Math.ceil((geometry.effectiveHouseDepth + geometry.baseWidth) / (internal.pieceLengthM ?? 3)),
      unit: "un",
      unitPriceBRL: internal.unitPriceBRL,
      discountBRL: 0,
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: false,
      notes: "Comprimento preliminar para acabamentos internos principais.",
    })
  );

  const tape = accessoryById["tacky-tape"];
  materialLines.push(
    line({
      id: "tacky-tape",
      code: tape.code,
      description: tape.description,
      category: "sealants",
      supplier: tape.supplier,
      quantity: Math.ceil((geometry.effectiveHouseDepth * 2) / (tape.pieceLengthM ?? project.materialAssumptions.tapeCoverageM)),
      unit: "un",
      unitPriceBRL: tape.unitPriceBRL,
      discountBRL: 0,
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: false,
      notes: "Cobertura preliminar para vedacao longitudinal.",
    })
  );

  for (const id of ["massa-vedante", "acab-lateral"]) {
    const item = accessoryById[id];
    materialLines.push(
      line({
        id,
        code: item.code,
        description: item.description,
        category: item.category,
        supplier: item.supplier,
        quantity: id === "acab-lateral" ? Math.ceil(2 * geometry.effectiveHouseDepth) : Math.ceil(layout.totalPanels / 36) * 2,
        unit: item.defaultUnit,
        unitPriceBRL: item.unitPriceBRL,
        discountBRL: 0,
        wasteIncluded: true,
        manualOverride: false,
        requiresConfirmation: true,
        notes: `${item.notes} Marcar como confirmar com fornecedor.`,
      })
    );
  }

  for (const item of project.customMaterials.filter((material) => material.enabled && material.quantity > 0)) {
    const { quantity, split } = customMaterialQuantity(item);
    materialLines.push(
      line({
        id: item.id,
        code: item.code,
        description: item.description,
        category: item.category,
        supplier: item.supplier,
        quantity,
        unit: item.unit,
        unitPriceBRL: item.unitPriceBRL,
        discountBRL: 0,
        wasteIncluded: split.exceeded,
        manualOverride: true,
        requiresConfirmation: !item.unitPriceBRL || split.exceeded,
        notes: `${item.notes}${
          split.exceeded
            ? ` Comprimento ${item.lengthM?.toFixed(2)} m excede maximo ${item.maxLengthM?.toFixed(
                2
              )} m; estimado em ${split.segments} pecas de ${split.segmentLengthM.toFixed(2)} m.`
            : ""
        }`,
      })
    );
  }

  return materialLines;
}
