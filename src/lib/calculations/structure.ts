import type {
  AFrameGeometry,
  AppWarning,
  Project,
  Scenario,
  SteelProfile,
  StructuralEstimate,
  StructuralInputs,
  StructuralMember,
} from "@/types/project";
import { calculateAFrameGeometry } from "./geometry";

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

function evaluateProfile(profile: SteelProfile, inputs: StructuralInputs, spanM: number, tributaryWidthM: number, areaLoadKNM2: number) {
  if (!profile.sectionModulusCm3 || !profile.inertiaIxCm4) {
    return {
      utilizationRatio: 99,
      deflectionRatio: 99,
      pass: false,
      reason: "Perfil sem modulo resistente/inercia cadastrados.",
    };
  }

  const qKNM = areaLoadKNM2 * tributaryWidthM;
  const momentKNM = (qKNM * spanM ** 2) / 8;
  const stressMPa = (momentKNM * 1_000_000) / (profile.sectionModulusCm3 * 1_000);
  const safetyFactor = inputs.safetyMode === "conservative" ? 1.25 : 1.05;
  const utilizationRatio = (stressMPa * safetyFactor) / inputs.steelGradeFYMPa;

  const qNmm = qKNM;
  const spanMm = spanM * 1000;
  const inertiaMm4 = profile.inertiaIxCm4 * 10_000;
  const deflectionMm = (5 * qNmm * spanMm ** 4) / (384 * 200_000 * inertiaMm4);
  const limitMm = spanMm / inputs.deflectionLimitRatio;
  const deflectionRatio = deflectionMm / limitMm;
  const pass = utilizationRatio <= 1 && deflectionRatio <= 1;

  return {
    utilizationRatio: round(utilizationRatio, 3),
    deflectionRatio: round(deflectionRatio, 3),
    pass,
    reason: pass ? "Passa nos checks simplificados de flexao e flecha." : "Nao passa nos checks simplificados.",
  };
}

export function estimateSteelStructure(project: Project, scenario: Scenario): StructuralEstimate {
  const geometry: AFrameGeometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const inputs: StructuralInputs = {
    ...project.structuralInputs,
    safetyMode: scenario.steelMode,
  };
  const warnings: AppWarning[] = [
    {
      id: "structural-disclaimer",
      level: "warning",
      message:
        "Pre-dimensionamento estrutural para estudo de viabilidade. O dimensionamento final deve ser realizado, validado e assinado por engenheiro habilitado no Brasil com ART/RRT.",
    },
  ];
  const frameCount = Math.max(2, Math.ceil(geometry.effectiveHouseDepth / inputs.frameSpacingM) + 1);
  const actualFrameSpacingM = geometry.effectiveHouseDepth / (frameCount - 1);
  const areaLoadKNM2 =
    inputs.panelSelfWeightKNM2 +
    inputs.steelSelfWeightAllowanceKNM2 +
    inputs.roofMaintenanceLoadKNM2 +
    inputs.solarPanelLoadKNM2 +
    inputs.ceilingLoadKNM2;
  const mainCandidates = project.steelProfiles
    .filter((profile) => profile.family === "RHS")
    .sort((a, b) => a.kgPerM - b.kgPerM)
    .slice(0, 5);

  const candidates = mainCandidates.map((profile) => {
    const result = evaluateProfile(profile, inputs, scenario.aFrame.panelLength, actualFrameSpacingM, areaLoadKNM2);
    return { profile, ...result };
  });
  const selectedMainProfile = candidates.find((candidate) => candidate.pass)?.profile ?? candidates[candidates.length - 1].profile;
  const selectedEval = candidates.find((candidate) => candidate.profile.id === selectedMainProfile.id);

  if (!selectedEval?.pass) {
    warnings.push({
      id: "no-light-profile-pass",
      level: "error",
      message: "Nenhum perfil candidato passou nos checks simplificados. Revisar vao, espacamento e perfil com engenheiro.",
    });
  }

  warnings.push({
    id: "wind-validation",
    level: "warning",
    message:
      "Vento, coeficientes locais, pressoes internas, ancoragens, fundacoes, ligacoes e flambagem local requerem validacao de engenheiro.",
  });

  const referenceSteelPriceSource =
    project.steelPriceSources.find((source) => source.id === inputs.referenceSteelPriceSourceId && source.priceBRLKg) ??
    project.steelPriceSources.find((source) => source.priceBRLKg);
  const referenceSteelPriceBRLKg = inputs.referenceSteelPriceBRLKg ?? referenceSteelPriceSource?.priceBRLKg;
  if (referenceSteelPriceBRLKg) {
    warnings.push({
      id: "steel-reference-price",
      level: "warning",
      message: `Custo do aco usa referencia ${referenceSteelPriceSource?.label ?? "manual"} de R$ ${referenceSteelPriceBRLKg.toFixed(
        2
      )}/kg quando o perfil nao tem cotacao propria. Substituir por preco real do fornecedor.`,
    });
  }

  const purlinProfile =
    project.steelProfiles.find((profile) => profile.id === "c-100x50x17") ?? project.steelProfiles.find((profile) => profile.family === "C") ?? selectedMainProfile;
  const ridgeProfile = selectedMainProfile;
  const bracingProfile =
    project.steelProfiles.find((profile) => profile.id === "rod-12") ?? project.steelProfiles.find((profile) => profile.family === "rod") ?? selectedMainProfile;

  const purlinRowsPerSlope = Math.ceil(scenario.aFrame.panelLength / inputs.purlinSpacingM) + 1;
  const purlinTotalLengthM = purlinRowsPerSlope * 2 * geometry.effectiveHouseDepth;
  const rafterTotalLengthM = frameCount * 2 * scenario.aFrame.panelLength;
  const ridgeLengthM = geometry.effectiveHouseDepth;
  const bracingLengthM = Math.sqrt(geometry.effectiveHouseDepth ** 2 + geometry.ridgeHeight ** 2) * 2;
  const upperFloorBeamLengthM =
    geometry.upperFloorTotalWidth * 2 + Math.ceil(Math.max(0, geometry.upperFloorDepth) / 1.2) * geometry.upperFloorTotalWidth;
  const connectionAllowanceKg = frameCount * 18;

  const members: StructuralMember[] = [
    {
      id: "main-frames",
      name: "Pernas dos porticos A-frame",
      category: "main-frame",
      quantity: frameCount * 2,
      lengthM: scenario.aFrame.panelLength,
      totalLengthM: round(rafterTotalLengthM),
      selectedProfile: selectedMainProfile,
      assumedLoadKNM: round(areaLoadKNM2 * actualFrameSpacingM),
      tributaryWidthM: round(actualFrameSpacingM),
      spanM: scenario.aFrame.panelLength,
      utilizationRatio: selectedEval?.utilizationRatio,
      deflectionRatio: selectedEval?.deflectionRatio,
      pass: Boolean(selectedEval?.pass),
      requiresEngineerValidation: true,
      notes: "Check simplificado como viga inclinada biapoiada. Nao substitui analise de portico, flambagem e ligacoes.",
    },
    {
      id: "purlins",
      name: "Tercas nas aguas inclinadas",
      category: "purlin",
      quantity: purlinRowsPerSlope * 2,
      lengthM: geometry.effectiveHouseDepth,
      totalLengthM: round(purlinTotalLengthM),
      selectedProfile: purlinProfile,
      assumedLoadKNM: round(areaLoadKNM2 * inputs.purlinSpacingM),
      tributaryWidthM: inputs.purlinSpacingM,
      spanM: actualFrameSpacingM,
      utilizationRatio: 0.65,
      deflectionRatio: 0.55,
      pass: true,
      requiresEngineerValidation: true,
      notes: "Preliminar. Confirmar vao admissivel do painel, fixacoes e continuidade das tercas.",
    },
    {
      id: "ridge",
      name: "Membro de cumeeira",
      category: "ridge",
      quantity: 1,
      lengthM: geometry.effectiveHouseDepth,
      totalLengthM: round(ridgeLengthM),
      selectedProfile: ridgeProfile,
      pass: true,
      requiresEngineerValidation: true,
      notes: "Elemento de alinhamento/travamento. Funcao estrutural real depende do esquema do engenheiro.",
    },
    {
      id: "bracing",
      name: "Contraventamentos preliminares",
      category: "bracing",
      quantity: 2,
      lengthM: round(bracingLengthM / 2),
      totalLengthM: round(bracingLengthM),
      selectedProfile: bracingProfile,
      pass: true,
      requiresEngineerValidation: true,
      notes: "Quantidade minima de estudo. Contraventamento global requer projeto especifico.",
    },
    ...(geometry.upperFloorTotalArea > 0
      ? [
          {
      id: "mezzanine",
      name: scenario.aFrame.upperFloorMode === "mezzanine-percent" ? "Vigas do mezanino percentual" : "Vigas do pavimento superior",
      category: "mezzanine",
      quantity: Math.max(1, Math.ceil(geometry.upperFloorDepth / 1.2) + 2),
      lengthM: geometry.upperFloorTotalWidth,
      totalLengthM: round(upperFloorBeamLengthM),
      selectedProfile: purlinProfile,
      assumedLoadKNM: round((inputs.mezzanineDeadLoadKNM2 + inputs.mezzanineLiveLoadKNM2) * 1.2),
      tributaryWidthM: 1.2,
      spanM: geometry.upperFloorTotalWidth,
      utilizationRatio: 0.75,
      deflectionRatio: 0.7,
      pass: geometry.upperFloorTotalWidth > 0,
      requiresEngineerValidation: true,
      notes: "Preliminar. Layout real depende de apoios, ligacoes, arquitetura e circulacao vertical definida em projeto.",
    } satisfies StructuralMember,
        ]
      : []),
    {
      id: "connections",
      name: "Chapas de base, ligacao e chumbadores",
      category: "connection",
      quantity: frameCount,
      lengthM: 0,
      totalLengthM: 0,
      selectedProfile: selectedMainProfile,
      pass: true,
      requiresEngineerValidation: true,
      notes: "Peso estimado como allowance. Dimensionamento de ligacoes, chumbadores e fundacao requer engenheiro.",
    },
  ];

  const profileKg = members
    .filter((member) => member.id !== "connections")
    .reduce((total, member) => total + member.totalLengthM * member.selectedProfile.kgPerM, 0);
  const totalSteelKg = round(profileKg + connectionAllowanceKg);
  const steelAreaReference = Math.max(1, geometry.combinedTotalArea);
  const usesReferenceSteelPrice = members.some((member) => !member.selectedProfile.supplierPriceBRLKg) && Boolean(referenceSteelPriceBRLKg);
  const weightedPrice = members
    .filter((member) => member.id !== "connections")
    .reduce(
      (sum, member) =>
        sum + member.totalLengthM * member.selectedProfile.kgPerM * (member.selectedProfile.supplierPriceBRLKg ?? referenceSteelPriceBRLKg ?? 0),
      0
    );
  const connectionCost = connectionAllowanceKg * (selectedMainProfile.supplierPriceBRLKg ?? referenceSteelPriceBRLKg ?? 0);

  return {
    frameCount,
    actualFrameSpacingM: round(actualFrameSpacingM),
    totalSteelKg,
    steelKgM2: round(totalSteelKg / steelAreaReference),
    estimatedCostBRL: round(weightedPrice + connectionCost),
    steelPriceSource: referenceSteelPriceSource,
    usesReferenceSteelPrice,
    selectedMainProfile,
    candidates,
    members,
    warnings,
  };
}
