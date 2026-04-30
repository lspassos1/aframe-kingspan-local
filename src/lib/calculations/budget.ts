import type { BudgetItem, BudgetSummary, MaterialLine, Project, Scenario, StructuralEstimate } from "@/types/project";
import { calculateAFrameGeometry } from "./geometry";
import { calculateMaterialList } from "./materials";
import { estimateSteelStructure } from "./structure";

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const asBudgetItem = (line: MaterialLine): BudgetItem => ({
  id: line.id,
  category: line.category,
  description: line.description,
  quantity: line.quantity,
  unit: line.unit,
  unitPriceBRL: line.unitPriceBRL,
  grossTotalBRL: line.grossTotalBRL,
  discountBRL: line.discountBRL,
  netTotalBRL: line.netTotalBRL,
  supplier: line.supplier,
  notes: line.notes,
  requiresConfirmation: line.requiresConfirmation,
});

export function isPriceStale(quoteDate: string, validDays: number, now = new Date()) {
  const parsed = new Date(`${quoteDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return true;
  const diffDays = (now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > validDays;
}

export function calculateBudget(project: Project, scenario: Scenario): BudgetSummary {
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const materialLines = calculateMaterialList(project, scenario);
  const structural: StructuralEstimate = estimateSteelStructure(project, scenario);
  const items: BudgetItem[] = materialLines.map(asBudgetItem);
  const panelPackageCostBRL = round(materialLines.filter((line) => line.category === "panels").reduce((sum, line) => sum + line.netTotalBRL, 0));
  const accessoriesCostBRL = round(
    materialLines.filter((line) => line.category !== "panels").reduce((sum, line) => sum + line.netTotalBRL, 0)
  );
  const freightBRL = scenario.pricing.freightBRL;
  const steelStructureCostBRL = structural.estimatedCostBRL;

  const civilPlaceholderBRL = round(
    project.budgetAssumptions.foundationPlaceholderBRL +
      project.budgetAssumptions.slabPlaceholderBRL +
      project.budgetAssumptions.drainagePlaceholderBRL
  );
  const facadePlaceholderBRL = round(
    project.budgetAssumptions.frontFacadePlaceholderBRL +
      project.budgetAssumptions.rearClosurePlaceholderBRL +
      project.budgetAssumptions.doorsWindowsPlaceholderBRL
  );
  const laborEquipmentBRL = round(
    geometry.roofInclinedArea * project.budgetAssumptions.panelInstallationLaborBRLM2 +
      structural.totalSteelKg * (project.budgetAssumptions.steelAssemblyLaborBRLKg ?? 0) +
      project.budgetAssumptions.liftingEquipmentBRL +
      project.budgetAssumptions.scaffoldingBRL
  );
  const technicalLegalBRL = round(
    project.budgetAssumptions.architectPlaceholderBRL +
      project.budgetAssumptions.engineerPlaceholderBRL +
      project.budgetAssumptions.municipalApprovalPlaceholderBRL
  );
  const subtotalBeforeContingency = round(
    panelPackageCostBRL +
      accessoriesCostBRL +
      freightBRL +
      steelStructureCostBRL +
      civilPlaceholderBRL +
      facadePlaceholderBRL +
      laborEquipmentBRL +
      technicalLegalBRL
  );
  const contingencyBRL = round(subtotalBeforeContingency * (project.budgetAssumptions.contingencyPercent / 100));
  const totalEstimatedCostBRL = round(subtotalBeforeContingency + contingencyBRL);

  items.push(
    {
      id: "freight",
      category: "freight",
      description: "Frete para o endereco do projeto",
      quantity: 1,
      unit: "lot",
      unitPriceBRL: freightBRL,
      grossTotalBRL: freightBRL,
      discountBRL: 0,
      netTotalBRL: freightBRL,
      supplier: "A confirmar",
      notes: "Frete separado do pacote de paineis.",
      requiresConfirmation: freightBRL === 0,
    },
    {
      id: "steel-structure",
      category: "steel",
      description: "Estrutura metalica preliminar",
      quantity: structural.totalSteelKg,
      unit: "kg",
      unitPriceBRL: structural.totalSteelKg > 0 ? steelStructureCostBRL / structural.totalSteelKg : 0,
      grossTotalBRL: steelStructureCostBRL,
      discountBRL: 0,
      netTotalBRL: steelStructureCostBRL,
      supplier: "A confirmar",
      notes: structural.usesReferenceSteelPrice
        ? "Custo usa preco/kg de referencia para viabilidade. Substituir por cotacao real de aço, fabricacao e entrega."
        : "Preco calculado com preco/kg cadastrado nos perfis; confirmar por cotacao formal.",
      requiresConfirmation: true,
    },
    {
      id: "civil-placeholder",
      category: "civil",
      description: "Fundacao, radier/laje e drenagem - placeholders",
      quantity: 1,
      unit: "lot",
      unitPriceBRL: civilPlaceholderBRL,
      grossTotalBRL: civilPlaceholderBRL,
      discountBRL: 0,
      netTotalBRL: civilPlaceholderBRL,
      supplier: "A confirmar",
      notes: "Nao inclui calculo de fundacao nem sondagem.",
      requiresConfirmation: true,
    },
    {
      id: "facade-placeholder",
      category: "facade",
      description: "Fachadas, portas e esquadrias - placeholders",
      quantity: 1,
      unit: "lot",
      unitPriceBRL: facadePlaceholderBRL,
      grossTotalBRL: facadePlaceholderBRL,
      discountBRL: 0,
      netTotalBRL: facadePlaceholderBRL,
      supplier: "A confirmar",
      notes: "Valores editaveis conforme projeto arquitetonico.",
      requiresConfirmation: true,
    },
    {
      id: "labor-equipment",
      category: "labor",
      description: "Mao de obra, equipamento de içamento e andaimes",
      quantity: 1,
      unit: "lot",
      unitPriceBRL: laborEquipmentBRL,
      grossTotalBRL: laborEquipmentBRL,
      discountBRL: 0,
      netTotalBRL: laborEquipmentBRL,
      supplier: "A confirmar",
      notes: "Valores editaveis. Nao usar como preco final.",
      requiresConfirmation: true,
    },
    {
      id: "technical-legal",
      category: "technical",
      description: "Arquitetura, engenharia, ART/RRT e aprovacao municipal",
      quantity: 1,
      unit: "lot",
      unitPriceBRL: technicalLegalBRL,
      grossTotalBRL: technicalLegalBRL,
      discountBRL: 0,
      netTotalBRL: technicalLegalBRL,
      supplier: "A confirmar",
      notes: "Placeholder obrigatorio para custos tecnicos e legais.",
      requiresConfirmation: true,
    },
    {
      id: "contingency",
      category: "contingency",
      description: `Contingencia (${project.budgetAssumptions.contingencyPercent}%)`,
      quantity: 1,
      unit: "lot",
      unitPriceBRL: contingencyBRL,
      grossTotalBRL: contingencyBRL,
      discountBRL: 0,
      netTotalBRL: contingencyBRL,
      supplier: "Interno",
      notes: "Percentual editavel nas premissas.",
      requiresConfirmation: false,
    }
  );

  const warnings = [...geometry.warnings, ...structural.warnings];
  if (isPriceStale(scenario.pricing.quoteDate, scenario.pricing.validDays)) {
    warnings.push({
      id: "price-stale",
      level: "warning",
      message: `A cotacao de precos venceu o periodo configurado de ${scenario.pricing.validDays} dias. Atualizar por RFQ ou importacao.`,
    });
  }

  return {
    items,
    panelPackageCostBRL,
    accessoriesCostBRL,
    freightBRL,
    steelStructureCostBRL,
    civilPlaceholderBRL,
    laborEquipmentBRL,
    technicalLegalBRL,
    contingencyBRL,
    totalEstimatedCostBRL,
    costPerTotalM2: round(totalEstimatedCostBRL / Math.max(1, geometry.combinedTotalArea)),
    costPerUsefulM2: round(totalEstimatedCostBRL / Math.max(1, geometry.combinedUsefulArea)),
    costPerGroundUsefulM2: round(totalEstimatedCostBRL / Math.max(1, geometry.groundUsefulArea)),
    warnings,
  };
}
