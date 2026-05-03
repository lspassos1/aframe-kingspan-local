import {
  compactValidationIssues,
  isRecord,
  positiveNumberIssue,
  validationResult,
  type ConstructionMethodDefinition,
  type ConstructionMethodInputs,
} from "@/lib/construction-methods/types";

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
  getDefaultInputs: () => ({
    widthM: 8,
    depthM: 12,
    floorHeightM: 2.8,
    epsCoreThicknessM: 0.08,
    renderThicknessPerFaceM: 0.03,
    panelWidthM: 1.2,
    panelHeightM: 2.8,
    useType: "infill",
    foundationType: "radier",
    starterBarsEnabled: true,
    openingReinforcementEnabled: true,
    specializedLaborRequired: true,
    wastePercent: 10,
  }),
  validateInputs: (inputs: unknown) => {
    if (!isRecord(inputs)) return validationResult([{ path: "", message: "Inputs devem ser um objeto." }]);
    const issues = compactValidationIssues([
      positiveNumberIssue(inputs, "widthM", "Largura deve ser maior que zero."),
      positiveNumberIssue(inputs, "depthM", "Profundidade deve ser maior que zero."),
      positiveNumberIssue(inputs, "panelWidthM", "Largura padrao dos paineis deve ser maior que zero."),
      positiveNumberIssue(inputs, "panelHeightM", "Altura padrao dos paineis deve ser maior que zero."),
    ]);
    return validationResult(issues);
  },
} satisfies ConstructionMethodDefinition<ConstructionMethodInputs>;
