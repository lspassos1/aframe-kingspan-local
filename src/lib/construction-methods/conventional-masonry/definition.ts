import {
  compactValidationIssues,
  isRecord,
  positiveNumberIssue,
  validationResult,
  type ConstructionMethodDefinition,
} from "@/lib/construction-methods/types";
import { calculateConventionalMasonryBudget, calculateConventionalMasonryBudgetItems } from "./budget";
import { calculateConventionalMasonryGeometry } from "./geometry";
import { defaultConventionalMasonryInputs } from "./inputs";
import { calculateConventionalMasonryMaterialList } from "./materials";
import { generateConventionalMasonry3DLayers } from "./three-layers";
import type { ConventionalMasonryInputs } from "./types";
import { calculateConventionalMasonryWarnings } from "./warnings";

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
  getDefaultInputs: () => ({ ...defaultConventionalMasonryInputs }),
  validateInputs: (inputs: unknown) => {
    if (!isRecord(inputs)) return validationResult([{ path: "", message: "Inputs devem ser um objeto." }]);
    const issues = compactValidationIssues([
      positiveNumberIssue(inputs, "widthM", "Largura deve ser maior que zero."),
      positiveNumberIssue(inputs, "depthM", "Profundidade deve ser maior que zero."),
      positiveNumberIssue(inputs, "floorHeightM", "Pe-direito deve ser maior que zero."),
      positiveNumberIssue(inputs, "floors", "Numero de pavimentos deve ser maior que zero."),
      positiveNumberIssue(inputs, "wallThicknessM", "Espessura de parede deve ser maior que zero."),
      positiveNumberIssue(inputs, "doorWidthM", "Largura de porta deve ser maior que zero."),
      positiveNumberIssue(inputs, "windowWidthM", "Largura de janela deve ser maior que zero."),
    ]);
    return validationResult(issues);
  },
  calculateGeometry: calculateConventionalMasonryGeometry,
  calculateMaterialList: calculateConventionalMasonryMaterialList,
  calculateBudgetItems: calculateConventionalMasonryBudgetItems,
  calculateBudget: calculateConventionalMasonryBudget,
  calculateWarnings: calculateConventionalMasonryWarnings,
  generate3DLayers: generateConventionalMasonry3DLayers,
} satisfies ConstructionMethodDefinition<ConventionalMasonryInputs>;
