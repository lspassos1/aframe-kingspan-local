import type { BudgetItem, BudgetSummary, MaterialLine } from "@/types/project";
import type { ConstructionMethodCalculationContext } from "@/lib/construction-methods/types";
import { calculateConventionalMasonryGeometry } from "./geometry";
import { calculateConventionalMasonryMaterialList } from "./materials";

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

function placeholderItem(id: string, description: string, value: number): BudgetItem {
  return {
    id,
    category: "civil",
    description,
    quantity: 1,
    unit: "lot",
    unitPriceBRL: value,
    grossTotalBRL: value,
    discountBRL: 0,
    netTotalBRL: value,
    supplier: "A confirmar",
    notes: "Valor placeholder editavel nas premissas; substituir por composicao ou cotacao formal.",
    requiresConfirmation: true,
  };
}

export function calculateConventionalMasonryBudget(context: ConstructionMethodCalculationContext): BudgetSummary {
  const { project } = context;
  const geometry = calculateConventionalMasonryGeometry(context);
  const materialLines = calculateConventionalMasonryMaterialList(context);
  const items = materialLines.map(asBudgetItem);
  const civilPlaceholderBRL = round(
    project.budgetAssumptions.foundationPlaceholderBRL + project.budgetAssumptions.slabPlaceholderBRL + project.budgetAssumptions.drainagePlaceholderBRL
  );
  const facadePlaceholderBRL = round(
    project.budgetAssumptions.frontFacadePlaceholderBRL +
      project.budgetAssumptions.rearClosurePlaceholderBRL +
      project.budgetAssumptions.doorsWindowsPlaceholderBRL
  );
  const laborEquipmentBRL = round(project.budgetAssumptions.scaffoldingBRL + project.budgetAssumptions.liftingEquipmentBRL);
  const technicalLegalBRL = round(
    project.budgetAssumptions.architectPlaceholderBRL +
      project.budgetAssumptions.engineerPlaceholderBRL +
      project.budgetAssumptions.municipalApprovalPlaceholderBRL
  );
  const subtotalBeforeContingency = round(civilPlaceholderBRL + facadePlaceholderBRL + laborEquipmentBRL + technicalLegalBRL);
  const contingencyBRL = round(subtotalBeforeContingency * (project.budgetAssumptions.contingencyPercent / 100));
  const totalEstimatedCostBRL = round(subtotalBeforeContingency + contingencyBRL);

  items.push(
    placeholderItem("masonry-civil-placeholder", "Fundacao, estrutura de concreto, formas e cobertura - placeholders", civilPlaceholderBRL),
    placeholderItem("masonry-facade-placeholder", "Esquadrias, fachadas e fechamentos - placeholders", facadePlaceholderBRL),
    {
      ...placeholderItem("masonry-labor-equipment", "Mao de obra e equipamentos - placeholders", laborEquipmentBRL),
      category: "labor",
    },
    {
      ...placeholderItem("masonry-technical-legal", "Arquitetura, engenharia, ART/RRT e aprovacao municipal", technicalLegalBRL),
      category: "technical",
    },
    {
      id: "masonry-contingency",
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

  return {
    items,
    panelPackageCostBRL: 0,
    accessoriesCostBRL: 0,
    freightBRL: 0,
    steelStructureCostBRL: 0,
    civilPlaceholderBRL,
    foundationCostBRL: 0,
    laborEquipmentBRL,
    technicalLegalBRL,
    contingencyBRL,
    totalEstimatedCostBRL,
    costPerTotalM2: round(totalEstimatedCostBRL / Math.max(1, geometry.builtAreaM2)),
    costPerUsefulM2: round(totalEstimatedCostBRL / Math.max(1, geometry.builtAreaM2)),
    costPerGroundUsefulM2: round(totalEstimatedCostBRL / Math.max(1, geometry.builtAreaM2)),
    warnings: geometry.warnings,
  };
}

export function calculateConventionalMasonryBudgetItems(context: ConstructionMethodCalculationContext): BudgetItem[] {
  return calculateConventionalMasonryBudget(context).items;
}
