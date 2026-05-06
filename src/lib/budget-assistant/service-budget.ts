import type {
  BudgetQuantity,
  BudgetServiceLine,
  ServiceComposition,
  WasteRule,
} from "./types";

export interface ServiceBudgetCompositionLink {
  id: string;
  quantityId: string;
  compositionId: string;
  approvedByUser: boolean;
}

export type DirectServiceBudgetSkipReason =
  | "not-approved"
  | "quantity-missing"
  | "composition-missing"
  | "scenario-incompatible"
  | "method-incompatible"
  | "unit-incompatible"
  | "approval-blocked";

export interface DirectServiceBudgetSkippedLink {
  link: ServiceBudgetCompositionLink;
  reason: DirectServiceBudgetSkipReason;
  message: string;
}

export interface DirectServiceBudgetInput {
  scenarioId: string;
  quantities: BudgetQuantity[];
  serviceCompositions: ServiceComposition[];
  links: ServiceBudgetCompositionLink[];
  bdiPercent?: number;
  contingencyPercent?: number;
  technicalProjectApproved?: boolean;
}

export interface DirectServiceBudgetSummary {
  lines: BudgetServiceLine[];
  skippedLinks: DirectServiceBudgetSkippedLink[];
  materialCostBRL: number;
  laborCostBRL: number;
  equipmentCostBRL: number;
  thirdPartyCostBRL: number;
  otherCostBRL: number;
  wasteCostBRL: number;
  directCostBRL: number;
  bdiBRL: number;
  contingencyBRL: number;
  totalBRL: number;
  totalLaborHours: number;
}

export function calculateDirectServiceBudget(input: DirectServiceBudgetInput): DirectServiceBudgetSummary {
  const quantitiesById = new Map(input.quantities.map((quantity) => [quantity.id, quantity]));
  const compositionsById = new Map(input.serviceCompositions.map((composition) => [composition.id, composition]));
  const lines: BudgetServiceLine[] = [];
  const skippedLinks: DirectServiceBudgetSkippedLink[] = [];

  for (const link of input.links) {
    const quantity = quantitiesById.get(link.quantityId);
    const composition = compositionsById.get(link.compositionId);
    const skipReason = getSkipReason(input.scenarioId, link, quantity, composition);
    if (skipReason) {
      skippedLinks.push({ link, reason: skipReason, message: createSkipMessage(link, skipReason) });
      continue;
    }

    lines.push(
      createBudgetServiceLine({
        scenarioId: input.scenarioId,
        quantity: quantity as BudgetQuantity,
        composition: composition as ServiceComposition,
        link,
        bdiPercent: input.bdiPercent ?? 0,
        contingencyPercent: input.contingencyPercent ?? 0,
        technicalProjectApproved: input.technicalProjectApproved ?? false,
      })
    );
  }

  return {
    lines,
    skippedLinks,
    materialCostBRL: sumLine(lines, "materialCostBRL"),
    laborCostBRL: sumLine(lines, "laborCostBRL"),
    equipmentCostBRL: sumLine(lines, "equipmentCostBRL"),
    thirdPartyCostBRL: sumLine(lines, "thirdPartyCostBRL"),
    otherCostBRL: sumLine(lines, "otherCostBRL"),
    wasteCostBRL: sumLine(lines, "wasteCostBRL"),
    directCostBRL: sumLine(lines, "directCostBRL"),
    bdiBRL: sumLine(lines, "bdiBRL"),
    contingencyBRL: sumLine(lines, "contingencyBRL"),
    totalBRL: sumLine(lines, "totalBRL"),
    totalLaborHours: sumLine(lines, "totalLaborHours", 4),
  };
}

function createBudgetServiceLine(input: {
  scenarioId: string;
  quantity: BudgetQuantity;
  composition: ServiceComposition;
  link: ServiceBudgetCompositionLink;
  bdiPercent: number;
  contingencyPercent: number;
  technicalProjectApproved: boolean;
}): BudgetServiceLine {
  const quantity = input.quantity.quantity;
  const materialCostBRL = round(input.composition.materialCostBRL * quantity);
  const laborCostBRL = round(input.composition.laborCostBRL * quantity);
  const equipmentCostBRL = round(input.composition.equipmentCostBRL * quantity);
  const thirdPartyCostBRL = round(input.composition.thirdPartyCostBRL * quantity);
  const otherCostBRL = round(input.composition.otherCostBRL * quantity);
  const wasteCostBRL = round(calculateWasteUnitCost(input.composition) * quantity);
  const directCostBRL = round(
    materialCostBRL + laborCostBRL + equipmentCostBRL + thirdPartyCostBRL + otherCostBRL + wasteCostBRL
  );
  const bdiBRL = round(directCostBRL * normalizePercent(input.bdiPercent));
  const contingencyBRL = round(directCostBRL * normalizePercent(input.contingencyPercent));
  const requiresReview =
    input.composition.requiresReview || isStructuralPreliminary(input.composition, input.technicalProjectApproved) || hasPendingSinapiPrice(input.composition);

  return {
    sourceId: input.composition.sourceId,
    sourceCode: input.composition.sourceCode || input.composition.serviceCode,
    referenceDate: input.composition.referenceDate,
    city: input.composition.city,
    state: input.composition.state,
    confidence: input.composition.confidence,
    requiresReview,
    notes: createLineNotes(input.composition, requiresReview),
    id: `service-line-${input.link.id}`,
    scenarioId: input.scenarioId,
    quantityId: input.quantity.id,
    compositionId: input.composition.id,
    constructionMethod: input.quantity.constructionMethod,
    category: input.quantity.category,
    description: input.composition.description,
    quantity,
    unit: input.quantity.unit,
    materialCostBRL,
    laborCostBRL,
    equipmentCostBRL,
    thirdPartyCostBRL,
    otherCostBRL,
    wasteCostBRL,
    directCostBRL,
    bdiBRL,
    contingencyBRL,
    totalBRL: round(directCostBRL + bdiBRL + contingencyBRL),
    totalLaborHours: round(getLaborHoursPerUnit(input.composition) * quantity, 4),
    approvedByUser: input.link.approvedByUser,
  };
}

function getSkipReason(
  scenarioId: string,
  link: ServiceBudgetCompositionLink,
  quantity: BudgetQuantity | undefined,
  composition: ServiceComposition | undefined
): DirectServiceBudgetSkipReason | null {
  if (!link.approvedByUser) return "not-approved";
  if (!quantity) return "quantity-missing";
  if (!composition) return "composition-missing";
  if (quantity.scenarioId !== scenarioId) return "scenario-incompatible";
  if (quantity.constructionMethod !== composition.constructionMethod) return "method-incompatible";
  if (quantity.unit !== composition.unit) return "unit-incompatible";
  return null;
}

function createSkipMessage(link: ServiceBudgetCompositionLink, reason: DirectServiceBudgetSkipReason) {
  if (reason === "not-approved") return `Vinculo "${link.id}" ainda nao foi aprovado.`;
  if (reason === "quantity-missing") return `Vinculo "${link.id}" aponta para quantitativo inexistente.`;
  if (reason === "composition-missing") return `Vinculo "${link.id}" aponta para composicao inexistente.`;
  if (reason === "scenario-incompatible") return `Vinculo "${link.id}" aponta para quantitativo de outro cenario.`;
  if (reason === "method-incompatible") return `Vinculo "${link.id}" possui metodo construtivo incompativel.`;
  if (reason === "approval-blocked") return `Vinculo "${link.id}" permanece pendente e nao entra no orcamento revisado.`;
  return `Vinculo "${link.id}" possui unidade incompativel.`;
}

function calculateWasteUnitCost(composition: ServiceComposition) {
  return composition.wasteRules.reduce((sum, rule) => sum + calculateWasteRuleUnitCost(composition, rule), 0);
}

function calculateWasteRuleUnitCost(composition: ServiceComposition, rule: WasteRule) {
  const base = composition.inputs
    .filter((input) => rule.appliesTo.includes(input.kind))
    .reduce((sum, input) => sum + input.total, 0);
  return base * normalizePercent(rule.percent);
}

function getLaborHoursPerUnit(composition: ServiceComposition) {
  if (composition.totalLaborHoursPerUnit > 0) return composition.totalLaborHoursPerUnit;
  return composition.laborRoles.reduce((sum, role) => sum + role.hoursPerUnit, 0);
}

function isStructuralPreliminary(composition: ServiceComposition, technicalProjectApproved: boolean) {
  if (technicalProjectApproved) return false;
  if (composition.category === "steel") return true;
  return composition.tags.some((tag) => isStructuralTag(tag));
}

function isStructuralTag(tag: string) {
  const normalized = tag
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return ["estrutura", "estrutural", "fundacao", "concreto", "aco"].some((term) => normalized.includes(term));
}

function createLineNotes(composition: ServiceComposition, requiresReview: boolean) {
  const structuralNote = requiresReview ? "Item sujeito a revisao tecnica antes de orcamento revisado." : "";
  const sinapiNote = hasPendingSinapiPrice(composition) ? `Preco SINAPI ${composition.sinapi?.priceStatus}; manter linha pendente.` : "";
  return [composition.notes, sinapiNote, structuralNote].filter(Boolean).join(" ");
}

function hasPendingSinapiPrice(composition: ServiceComposition) {
  return Boolean(composition.sinapi && composition.sinapi.priceStatus !== "valid");
}

function normalizePercent(percent: number) {
  return Math.max(0, percent) / 100;
}

function sumLine(lines: BudgetServiceLine[], key: keyof BudgetServiceLine, decimals = 2) {
  return round(
    lines.reduce((sum, line) => {
      const value = line[key];
      return typeof value === "number" ? sum + value : sum;
    }, 0),
    decimals
  );
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
