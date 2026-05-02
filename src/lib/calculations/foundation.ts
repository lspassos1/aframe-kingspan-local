import type { BudgetItem, FoundationAssumptions, FoundationEstimate, Scenario } from "@/types/project";
import { calculateAFrameGeometry } from "./geometry";

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

function budgetItem(input: Omit<BudgetItem, "grossTotalBRL" | "discountBRL" | "netTotalBRL">): BudgetItem {
  const grossTotalBRL = round(input.quantity * (input.unitPriceBRL ?? 0));
  return {
    ...input,
    grossTotalBRL,
    discountBRL: 0,
    netTotalBRL: grossTotalBRL,
  };
}

export function estimateRadierFoundation(scenario: Scenario, assumptions: FoundationAssumptions): FoundationEstimate {
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const widthM = assumptions.useHouseFootprint ? geometry.baseWidth + assumptions.extraPerimeterM * 2 : scenario.terrain.width;
  const depthM = assumptions.useHouseFootprint ? geometry.effectiveHouseDepth + assumptions.extraPerimeterM * 2 : scenario.terrain.depth;
  const areaM2 = widthM * depthM;
  const perimeterM = 2 * (widthM + depthM);
  const slabConcreteM3 = areaM2 * assumptions.slabThicknessM;
  const edgeBeamConcreteM3 = perimeterM * assumptions.edgeBeamWidthM * assumptions.edgeBeamDepthM;
  const concreteM3 = (slabConcreteM3 + edgeBeamConcreteM3) * (1 + assumptions.wastePercent / 100);
  const fiberKg = concreteM3 * assumptions.fiberDosageKgM3;
  const subbaseM3 = areaM2 * assumptions.subbaseThicknessM;
  const vaporBarrierM2 = areaM2 * 1.05;
  const formworkM = perimeterM;

  const items: BudgetItem[] = [
    budgetItem({
      id: "foundation-concrete",
      category: "civil",
      description: "Concreto usinado/bombeavel para radier com fibras",
      quantity: round(concreteM3),
      unit: "m3",
      unitPriceBRL: assumptions.concreteUnitPriceBRLM3,
      supplier: "Concreteira / fornecedor local",
      notes: "Volume inclui placa, vigas de borda e perda. Confirmar fck, slump, bombeamento e lancamento.",
      requiresConfirmation: true,
    }),
    budgetItem({
      id: "foundation-fiber",
      category: "civil",
      description: "Fibra para concreto do radier",
      quantity: round(fiberKg),
      unit: "kg",
      unitPriceBRL: assumptions.fiberUnitPriceBRLKg,
      supplier: "Fornecedor de fibra",
      notes: "Dosagem preliminar em kg/m3. Engenheiro deve validar tipo, dosagem e desempenho.",
      requiresConfirmation: true,
    }),
    budgetItem({
      id: "foundation-subbase",
      category: "civil",
      description: "Sub-base granular compactada",
      quantity: round(subbaseM3),
      unit: "m3",
      unitPriceBRL: assumptions.subbaseUnitPriceBRLM3,
      supplier: "A confirmar",
      notes: "Volume preliminar para camada de regularizacao/sub-base.",
      requiresConfirmation: true,
    }),
    budgetItem({
      id: "foundation-vapor-barrier",
      category: "civil",
      description: "Lona/barreira de vapor sob radier",
      quantity: round(vaporBarrierM2),
      unit: "m2",
      unitPriceBRL: assumptions.vaporBarrierUnitPriceBRLM2,
      supplier: "A confirmar",
      notes: "Area com pequena sobreposicao.",
      requiresConfirmation: true,
    }),
    budgetItem({
      id: "foundation-formwork",
      category: "civil",
      description: "Forma lateral do radier",
      quantity: round(formworkM),
      unit: "m",
      unitPriceBRL: assumptions.formworkUnitPriceBRLM,
      supplier: "A confirmar",
      notes: "Perimetro externo preliminar.",
      requiresConfirmation: true,
    }),
    budgetItem({
      id: "foundation-soil-prep",
      category: "civil",
      description: "Preparacao, nivelamento e compactacao do terreno",
      quantity: round(areaM2),
      unit: "m2",
      unitPriceBRL: assumptions.soilPrepUnitPriceBRLM2,
      supplier: "A confirmar",
      notes: "Nao substitui sondagem, terraplenagem real ou projeto de fundacao.",
      requiresConfirmation: true,
    }),
    budgetItem({
      id: "foundation-labor",
      category: "civil",
      description: "Mao de obra de execucao do radier",
      quantity: round(areaM2),
      unit: "m2",
      unitPriceBRL: assumptions.laborUnitPriceBRLM2,
      supplier: "Empreiteiro / equipe local",
      notes: "Inclui lancamento/acabamento preliminar; confirmar escopo.",
      requiresConfirmation: true,
    }),
    budgetItem({
      id: "foundation-pump",
      category: "civil",
      description: "Mobilizacao/equipamento de bombeamento",
      quantity: assumptions.pumpBRL > 0 ? 1 : 0,
      unit: "lot",
      unitPriceBRL: assumptions.pumpBRL,
      supplier: "Concreteira / bombeamento",
      notes: "Item separado para comparar concreto com e sem bomba.",
      requiresConfirmation: true,
    }),
  ];

  const totalBRL = round(items.reduce((sum, item) => sum + item.netTotalBRL, 0));

  return {
    areaM2: round(areaM2),
    widthM: round(widthM),
    depthM: round(depthM),
    perimeterM: round(perimeterM),
    slabConcreteM3: round(slabConcreteM3),
    edgeBeamConcreteM3: round(edgeBeamConcreteM3),
    concreteM3: round(concreteM3),
    fiberKg: round(fiberKg),
    subbaseM3: round(subbaseM3),
    vaporBarrierM2: round(vaporBarrierM2),
    formworkM: round(formworkM),
    totalBRL,
    items,
    warnings: [
      {
        id: "foundation-validation",
        level: "warning",
        message: "Radier com fibras depende de sondagem, cargas reais, projeto estrutural, drenagem e detalhamento por engenheiro.",
      },
    ],
  };
}
