import type { AFrameGeometry, AFrameInputs, AppWarning, Terrain } from "@/types/project";

const degToRad = (value: number) => (value * Math.PI) / 180;

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function calculateAFrameGeometry(terrain: Terrain, input: AFrameInputs): AFrameGeometry {
  const warnings: AppWarning[] = [];
  const legacyInput = input as AFrameInputs & { mezzanineFloorHeight?: number; mezzanineDepth?: number };
  const angleRad = degToRad(input.baseAngleDeg);
  const tan = Math.tan(angleRad);
  const baseWidth = 2 * input.panelLength * Math.cos(angleRad);
  const ridgeHeight = input.panelLength * Math.sin(angleRad);
  const apexAngleDeg = 180 - 2 * input.baseAngleDeg;
  const deadZoneEachSide = input.minimumUsefulHeight / tan;
  const groundUsefulWidth = Math.max(0, baseWidth - 2 * deadZoneEachSide);
  const effectiveHouseDepth =
    input.automaticDepth && groundUsefulWidth > 0
      ? input.targetGroundUsefulArea / groundUsefulWidth
      : input.houseDepth;

  const upperFloorLevelHeight = input.upperFloorLevelHeight ?? legacyInput.mezzanineFloorHeight ?? 2.8;
  const upperFloorMode = input.upperFloorMode ?? "full-floor";
  const requestedUpperPercent =
    upperFloorMode === "none" ? 0 : upperFloorMode === "full-floor" ? 100 : Math.min(100, Math.max(0, input.upperFloorAreaPercent ?? 100));
  const upperFloorY = upperFloorLevelHeight + input.floorBuildUpThickness;
  const upperFloorTotalWidth = Math.max(0, baseWidth - 2 * (upperFloorY / tan));
  const upperFloorUsefulY = upperFloorY + input.minimumUsefulHeight;
  const upperFloorUsefulWidth = Math.max(0, baseWidth - 2 * (upperFloorUsefulY / tan));
  const upperFloorDepth = upperFloorMode === "none" ? 0 : effectiveHouseDepth * (requestedUpperPercent / 100);
  const groundFloorTotalArea = baseWidth * effectiveHouseDepth;
  const groundUsefulArea = groundUsefulWidth * effectiveHouseDepth;
  const upperFloorTotalArea = upperFloorTotalWidth * upperFloorDepth;
  const upperFloorUsefulArea = upperFloorUsefulWidth * upperFloorDepth;
  const facadeTriangularArea = (baseWidth * ridgeHeight) / 2;
  const roofInclinedArea = 2 * input.panelLength * effectiveHouseDepth;
  const houseVolumeApprox = facadeTriangularArea * effectiveHouseDepth;
  const totalWidthWithOffsets = baseWidth + 2 * input.lateralBaseFlashingOffset;
  const totalDepthWithOverhangs = effectiveHouseDepth + input.frontOverhang + input.rearOverhang;

  const availableWidth = terrain.width - terrain.leftSetback - terrain.rightSetback;
  const availableDepth = terrain.depth - terrain.frontSetback - terrain.rearSetback;
  const clearances = {
    left: (terrain.width - totalWidthWithOffsets) / 2,
    right: (terrain.width - totalWidthWithOffsets) / 2,
    front: (terrain.depth - totalDepthWithOverhangs) / 2,
    rear: (terrain.depth - totalDepthWithOverhangs) / 2,
  };

  if (totalWidthWithOffsets > terrain.width) {
    warnings.push({
      id: "width-exceeds-plot",
      level: "error",
      message: "A largura da casa excede a largura do lote.",
    });
  }

  if (totalDepthWithOverhangs > terrain.depth) {
    warnings.push({
      id: "depth-exceeds-plot",
      level: "error",
      message: "A profundidade da casa excede a profundidade do lote.",
    });
  }

  if (totalWidthWithOffsets > availableWidth) {
    warnings.push({
      id: "width-setback",
      level: "warning",
      message: "A largura viola os recuos laterais definidos.",
    });
  }

  if (totalDepthWithOverhangs > availableDepth) {
    warnings.push({
      id: "depth-setback",
      level: "warning",
      message: "A profundidade viola os recuos frontal/posterior definidos.",
    });
  }

  if (groundUsefulWidth < 3) {
    warnings.push({
      id: "small-ground-useful-width",
      level: "warning",
      message: "A largura util do terreo ficou pequena para uso confortavel.",
    });
  }

  if (upperFloorMode !== "none" && upperFloorUsefulArea < 12) {
    warnings.push({
      id: "small-upper-floor",
      level: "warning",
      message: "A area util do pavimento superior/mezanino pode ser impratica nesta configuracao.",
    });
  }

  if (upperFloorMode === "full-floor" && upperFloorUsefulWidth < 2.4) {
    warnings.push({
      id: "upper-floor-useful-width",
      level: "warning",
      message: "O segundo pavimento completo tem pouca largura util com o pe-direito minimo atual.",
    });
  }

  if (ridgeHeight > 9) {
    warnings.push({
      id: "excessive-height",
      level: "warning",
      message: "A cumeeira ficou alta; confirmar vento, travamentos e viabilidade executiva.",
    });
  }

  if (effectiveHouseDepth > terrain.depth) {
    warnings.push({
      id: "auto-depth-too-long",
      level: "warning",
      message: "A profundidade calculada para atingir a area alvo ficou maior que o lote.",
    });
  }

  if (input.panelLength > 12) {
    warnings.push({
      id: "panel-length-availability",
      level: "warning",
      message: "Comprimento do painel acima de 12 m exige confirmacao de fabricacao, transporte e montagem.",
    });
  }

  const fitsTerrain = totalWidthWithOffsets <= availableWidth && totalDepthWithOverhangs <= availableDepth;

  return {
    baseWidth: round(baseWidth),
    ridgeHeight: round(ridgeHeight),
    apexAngleDeg: round(apexAngleDeg),
    effectiveHouseDepth: round(effectiveHouseDepth),
    groundFloorTotalArea: round(groundFloorTotalArea),
    deadZoneEachSide: round(deadZoneEachSide),
    groundUsefulWidth: round(groundUsefulWidth),
    groundUsefulArea: round(groundUsefulArea),
    upperFloorTotalWidth: round(upperFloorTotalWidth),
    upperFloorUsefulWidth: round(upperFloorUsefulWidth),
    upperFloorTotalArea: round(upperFloorTotalArea),
    upperFloorUsefulArea: round(upperFloorUsefulArea),
    upperFloorDepth: round(upperFloorDepth),
    upperFloorAreaPercent: round(requestedUpperPercent),
    mezzanineTotalWidth: round(upperFloorTotalWidth),
    mezzanineUsefulWidth: round(upperFloorUsefulWidth),
    mezzanineTotalArea: round(upperFloorTotalArea),
    mezzanineUsefulArea: round(upperFloorUsefulArea),
    combinedTotalArea: round(groundFloorTotalArea + upperFloorTotalArea),
    combinedUsefulArea: round(groundUsefulArea + upperFloorUsefulArea),
    houseVolumeApprox: round(houseVolumeApprox),
    facadeTriangularArea: round(facadeTriangularArea),
    totalFacadeArea: round(facadeTriangularArea * 2),
    roofInclinedArea: round(roofInclinedArea),
    clearances: {
      front: round(clearances.front),
      rear: round(clearances.rear),
      left: round(clearances.left),
      right: round(clearances.right),
    },
    fitsTerrain,
    warnings,
  };
}
