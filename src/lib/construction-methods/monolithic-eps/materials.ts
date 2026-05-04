import type { MaterialLine } from "@/types/project";
import type { ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";
import { calculateMonolithicEpsGeometry } from "./geometry";
import { normalizeMonolithicEpsInputs } from "./inputs";

const emptyCost = {
  unitPriceBRL: undefined,
  grossTotalBRL: 0,
  discountBRL: 0,
  netTotalBRL: 0,
} as const;

function line(input: Omit<MaterialLine, "unitPriceBRL" | "grossTotalBRL" | "discountBRL" | "netTotalBRL">): MaterialLine {
  return {
    ...input,
    ...emptyCost,
  };
}

export function calculateMonolithicEpsMaterialList(context: ConstructionMethodCalculationContext): MaterialLine[] {
  const geometry = calculateMonolithicEpsGeometry(context);
  const inputs = normalizeMonolithicEpsInputs(context.scenario.methodInputs?.["monolithic-eps"]);
  const lines: MaterialLine[] = [
    line({
      id: "eps-panels",
      code: "painel-eps",
      description: "Paineis EPS monoliticos preliminares",
      category: "panels",
      supplier: "A cotar",
      quantity: geometry.panelCount,
      unit: "un",
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: true,
      notes: `${geometry.netPanelAreaM2} m2 liquidos com paineis ${inputs.panelWidthM} x ${inputs.panelHeightM} m e ${inputs.wastePercent}% de perda.`,
    }),
    line({
      id: "eps-render",
      code: "argamassa-concreto-face",
      description: "Argamassa/concreto aplicado nas duas faces",
      category: "civil",
      supplier: "A cotar",
      quantity: geometry.renderVolumeM3,
      unit: "m3",
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: true,
      notes: `${inputs.renderThicknessPerFaceM} m por face; confirmar especificacao do sistema.`,
    }),
    line({
      id: "eps-mesh",
      code: "malha-metalica",
      description: "Tela/malha metalica estimada",
      category: "steel",
      supplier: "A cotar",
      quantity: geometry.meshAreaM2,
      unit: "m2",
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: true,
      notes: "Area nas duas faces; confirmar tela, grampos, transpasses e reforcos do fabricante.",
    }),
    line({
      id: "eps-connectors",
      code: "conectores-grampos",
      description: "Conectores/grampos preliminares",
      category: "steel",
      supplier: "A cotar",
      quantity: geometry.connectorCount,
      unit: "un",
      wasteIncluded: true,
      manualOverride: false,
      requiresConfirmation: true,
      notes: "Coeficiente preliminar por area de painel.",
    }),
  ];

  if (geometry.starterBars > 0) {
    lines.push(
      line({
        id: "eps-starter-bars",
        code: "arranques",
        description: "Arranques na fundacao",
        category: "steel",
        supplier: "A cotar",
        quantity: geometry.starterBars,
        unit: "un",
        wasteIncluded: true,
        manualOverride: false,
        requiresConfirmation: true,
        notes: "Quantidade preliminar; depende do projeto da fundacao e do sistema.",
      })
    );
  }

  if (geometry.openingReinforcementM > 0) {
    lines.push(
      line({
        id: "eps-opening-reinforcement",
        code: "reforco-aberturas",
        description: "Reforcos em portas e janelas",
        category: "steel",
        supplier: "A cotar",
        quantity: geometry.openingReinforcementM,
        unit: "m",
        wasteIncluded: true,
        manualOverride: false,
        requiresConfirmation: true,
        notes: "Perimetro preliminar das aberturas; confirmar detalhes do fornecedor.",
      })
    );
  }

  if (inputs.projectionEquipmentRequired) {
    lines.push(
      line({
        id: "eps-projection-equipment",
        code: "equipamento-projecao",
        description: "Equipamento de projecao - placeholder",
        category: "other",
        supplier: "A confirmar",
        quantity: 1,
        unit: "lot",
        wasteIncluded: false,
        manualOverride: false,
        requiresConfirmation: true,
        notes: "Mobilizacao/equipamento depende da equipe e do sistema adotado.",
      })
    );
  }

  return lines;
}
