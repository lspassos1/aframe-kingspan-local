import {
  compactValidationIssues,
  isRecord,
  positiveNumberIssue,
  validationResult,
  type ConstructionMethodDefinition,
  type ConstructionMethodInputs,
} from "@/lib/construction-methods/types";
import { generateConventionalMasonry3DLayers } from "./three-layers";

export const conventionalMasonryDefinition = {
  id: "conventional-masonry",
  name: "Alvenaria convencional",
  shortDescription: "Estimativa preliminar para casa retangular em alvenaria com blocos, revestimentos e placeholders estruturais.",
  bestFor: "Comparar quantitativos iniciais de uma solucao tradicional com fundacao, paredes, cobertura e acabamentos basicos.",
  benefits: ["Sistema conhecido no mercado", "Boa base para cotacoes convencionais", "Entradas simples para estudo inicial"],
  limitations: ["Nao dimensiona pilares, vigas, lajes ou fundacoes", "Quantitativos dependem da planta executiva", "Grandes vaos exigem engenharia especifica"],
  defaultWarnings: [
    {
      id: "masonry-structural-project-required",
      level: "warning",
      message: "Concreto, aco e estrutura sao placeholders preliminares e nao substituem projeto estrutural.",
    },
  ],
  complexity: "medium",
  speed: "medium",
  industrializationLevel: "low",
  getDefaultInputs: () => ({
    widthM: 8,
    depthM: 12,
    floors: 1,
    floorHeightM: 2.8,
    internalWallLengthM: 20,
    blockType: "ceramic",
    wallThicknessM: 0.14,
    foundationType: "placeholder",
    roofType: "simple-roof",
    wastePercent: 10,
  }),
  validateInputs: (inputs: unknown) => {
    if (!isRecord(inputs)) return validationResult([{ path: "", message: "Inputs devem ser um objeto." }]);
    const issues = compactValidationIssues([
      positiveNumberIssue(inputs, "widthM", "Largura deve ser maior que zero."),
      positiveNumberIssue(inputs, "depthM", "Profundidade deve ser maior que zero."),
      positiveNumberIssue(inputs, "floorHeightM", "Pe-direito deve ser maior que zero."),
    ]);
    return validationResult(issues);
  },
  generate3DLayers: generateConventionalMasonry3DLayers,
} satisfies ConstructionMethodDefinition<ConstructionMethodInputs>;
