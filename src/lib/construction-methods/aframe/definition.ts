import {
  compactValidationIssues,
  isRecord,
  positiveNumberIssue,
  validationResult,
  type ConstructionMethodDefinition,
  type ConstructionMethodInputs,
} from "@/lib/construction-methods/types";

export const aframeDefinition = {
  id: "aframe",
  name: "A-frame com paineis",
  shortDescription: "Pre-projeto A-frame com paineis sanduiche, geometria inclinada, materiais, estrutura preliminar e orçamento.",
  bestFor: "Estudos rapidos de cabanas, casas compactas e volumes inclinados com montagem industrializada por paineis.",
  benefits: ["Modelo A-frame atual preservado", "Quantitativos de paineis ja disponiveis", "Visualizacao 3D existente"],
  limitations: ["Nao substitui projeto estrutural", "Comprimentos de painel dependem de fabricacao e transporte", "Fachadas e detalhes executivos exigem projeto"],
  defaultWarnings: [
    {
      id: "aframe-engineering-required",
      level: "warning",
      message: "Estrutura, fundacoes, ligacoes, vento e ART/RRT exigem profissional habilitado.",
    },
  ],
  complexity: "medium",
  speed: "fast",
  industrializationLevel: "high",
  getDefaultInputs: () => ({
    panelLength: 7.5,
    panelUsefulWidth: 1,
    panelThickness: 30,
    baseAngleDeg: 50,
    houseDepth: 17.3,
    minimumUsefulHeight: 1.5,
    upperFloorMode: "full-floor",
    upperFloorAreaPercent: 100,
    facadeType: "mixed",
  }),
  validateInputs: (inputs: unknown) => {
    if (!isRecord(inputs)) return validationResult([{ path: "", message: "Inputs devem ser um objeto." }]);
    const issues = compactValidationIssues([
      positiveNumberIssue(inputs, "panelLength", "Comprimento do painel deve ser maior que zero."),
      positiveNumberIssue(inputs, "panelUsefulWidth", "Largura util do painel deve ser maior que zero."),
      positiveNumberIssue(inputs, "houseDepth", "Profundidade da casa deve ser maior que zero."),
    ]);
    return validationResult(issues);
  },
} satisfies ConstructionMethodDefinition<ConstructionMethodInputs>;
