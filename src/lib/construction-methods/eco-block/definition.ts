import {
  compactValidationIssues,
  isRecord,
  positiveNumberIssue,
  validationResult,
  type ConstructionMethodDefinition,
  type ConstructionMethodInputs,
} from "@/lib/construction-methods/types";
import { generateEcoBlock3DLayers } from "./three-layers";

export const ecoBlockDefinition = {
  id: "eco-block",
  name: "Bloco ecologico / solo-cimento",
  shortDescription: "Estimativa preliminar para paredes moduladas em solo-cimento, com uso aparente ou rebocado.",
  bestFor: "Estudos de viabilidade com bloco modular, reducao de revestimentos e comparacao de graute/armaduras preliminares.",
  benefits: ["Favorece modulacao", "Pode reduzir revestimentos quando aparente", "Quantitativos simples por area liquida de parede"],
  limitations: ["Nao assume funcao estrutural automaticamente", "Depende de sistema validado e mao de obra adequada", "Instalacoes precisam ser compatibilizadas cedo"],
  defaultWarnings: [
    {
      id: "eco-block-structural-assumption",
      level: "warning",
      message: "Uso estrutural de solo-cimento depende de calculo, sistema validado, fornecedor e ART/RRT.",
    },
  ],
  complexity: "medium",
  speed: "medium",
  industrializationLevel: "medium",
  getDefaultInputs: () => ({
    widthM: 8,
    depthM: 12,
    floorHeightM: 2.8,
    blocksPerM2: 64,
    useType: "infill",
    finishType: "exposed",
    groutingEnabled: false,
    verticalRebarEnabled: false,
    horizontalRebarEnabled: false,
    baseWaterproofingEnabled: true,
    wastePercent: 10,
  }),
  validateInputs: (inputs: unknown) => {
    if (!isRecord(inputs)) return validationResult([{ path: "", message: "Inputs devem ser um objeto." }]);
    const issues = compactValidationIssues([
      positiveNumberIssue(inputs, "widthM", "Largura deve ser maior que zero."),
      positiveNumberIssue(inputs, "depthM", "Profundidade deve ser maior que zero."),
      positiveNumberIssue(inputs, "blocksPerM2", "Blocos por metro quadrado deve ser maior que zero."),
    ]);
    return validationResult(issues);
  },
  generate3DLayers: generateEcoBlock3DLayers,
} satisfies ConstructionMethodDefinition<ConstructionMethodInputs>;
