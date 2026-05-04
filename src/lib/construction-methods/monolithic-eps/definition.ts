import {
  compactValidationIssues,
  isRecord,
  positiveNumberIssue,
  validationResult,
  type ConstructionMethodDefinition,
} from "@/lib/construction-methods/types";
import { calculateMonolithicEpsBudget, calculateMonolithicEpsBudgetItems } from "./budget";
import { calculateMonolithicEpsGeometry } from "./geometry";
import { defaultMonolithicEpsInputs, normalizeMonolithicEpsInputs } from "./inputs";
import { calculateMonolithicEpsMaterialList } from "./materials";
import { generateMonolithicEps3DLayers } from "./three-layers";
import type { MonolithicEpsInputs } from "./types";
import { calculateMonolithicEpsWarnings } from "./warnings";

export const monolithicEpsDefinition = {
  id: "monolithic-eps",
  name: "Paineis monoliticos EPS",
  shortDescription: "Estimativa preliminar para paineis EPS com malha metalica e revestimento projetado/aplicado por face.",
  bestFor: "Estudos de sistemas industrializados com paineis verticais, cortes de aberturas e mao de obra especializada.",
  benefits: ["Sistema com montagem por paineis", "Boa leitura por camadas", "Quantitativos de area, argamassa/concreto e conectores"],
  limitations: ["Depende de fornecedor e documentacao tecnica", "Nao assume desempenho estrutural sem validacao", "Instalacoes devem ser compatibilizadas antes da projecao"],
  defaultWarnings: [
    {
      id: "eps-system-validation",
      level: "warning",
      message: "Sistema EPS monolitico requer fornecedor, documentacao tecnica, validacao, ART/RRT e mao de obra especializada.",
    },
  ],
  complexity: "high",
  speed: "fast",
  industrializationLevel: "high",
  getDefaultInputs: () => ({ ...defaultMonolithicEpsInputs }),
  validateInputs: (inputs: unknown) => {
    if (!isRecord(inputs)) return validationResult([{ path: "", message: "Inputs devem ser um objeto." }]);
    const issues = compactValidationIssues([
      positiveNumberIssue(inputs, "widthM", "Largura deve ser maior que zero."),
      positiveNumberIssue(inputs, "depthM", "Profundidade deve ser maior que zero."),
      positiveNumberIssue(inputs, "floorHeightM", "Pe-direito deve ser maior que zero."),
      positiveNumberIssue(inputs, "epsCoreThicknessM", "Espessura do EPS deve ser maior que zero."),
      positiveNumberIssue(inputs, "renderThicknessPerFaceM", "Espessura de revestimento por face deve ser maior que zero."),
      positiveNumberIssue(inputs, "panelWidthM", "Largura padrao dos paineis deve ser maior que zero."),
      positiveNumberIssue(inputs, "panelHeightM", "Altura padrao dos paineis deve ser maior que zero."),
    ]);
    return validationResult(issues);
  },
  calculateGeometry: calculateMonolithicEpsGeometry,
  calculateMaterialList: calculateMonolithicEpsMaterialList,
  calculateBudgetItems: calculateMonolithicEpsBudgetItems,
  calculateBudget: calculateMonolithicEpsBudget,
  calculateWarnings: ({ scenario }) => calculateMonolithicEpsWarnings(normalizeMonolithicEpsInputs(scenario.methodInputs?.["monolithic-eps"])),
  generate3DLayers: generateMonolithicEps3DLayers,
} satisfies ConstructionMethodDefinition<MonolithicEpsInputs>;
