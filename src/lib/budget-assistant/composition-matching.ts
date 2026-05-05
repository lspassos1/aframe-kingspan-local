import { normalizeBrazilStateName } from "@/lib/locations/brazil";
import type { BudgetConfidenceLevel, BudgetQuantity, ServiceComposition } from "./types";
import type { ServiceBudgetCompositionLink } from "./service-budget";

export interface BudgetCompositionMatch extends ServiceBudgetCompositionLink {
  confidence: BudgetConfidenceLevel;
  reason: string;
  unitCompatible: boolean;
  requiresReview: boolean;
}

export interface CompositionMatchLocation {
  city: string;
  state: string;
}

export interface CompositionMatchInput {
  quantities: BudgetQuantity[];
  serviceCompositions: ServiceComposition[];
  location?: CompositionMatchLocation;
  existingLinks?: ServiceBudgetCompositionLink[];
  maxCandidatesPerQuantity?: number;
}

export interface ServiceCompositionCandidateScore {
  total: number;
  unitCompatible: boolean;
  categoryCompatible: boolean;
  regionScore: number;
  textOverlap: number;
  tagOverlap: number;
}

export interface ServiceCompositionCandidate {
  quantity: BudgetQuantity;
  composition: ServiceComposition;
  score: ServiceCompositionCandidateScore;
  reason: string;
}

export function findServiceCompositionCandidates(input: CompositionMatchInput): ServiceCompositionCandidate[] {
  const maxCandidates = clampCandidateLimit(input.maxCandidatesPerQuantity ?? 10);
  const existingKeys = new Set((input.existingLinks ?? []).map((link) => createLinkKey(link.quantityId, link.compositionId)));

  return input.quantities.flatMap((quantity) => {
    const candidates = input.serviceCompositions
      .filter((composition) => composition.constructionMethod === quantity.constructionMethod)
      .filter((composition) => !existingKeys.has(createLinkKey(quantity.id, composition.id)))
      .map((composition) => {
        const score = scoreServiceCompositionCandidate(quantity, composition, input.location);
        return { quantity, composition, score, reason: createCandidateReason(quantity, composition, score, input.location) };
      })
      .filter((candidate) => candidate.score.total >= 0.2)
      .sort(compareCandidates);

    return candidates.slice(0, maxCandidates);
  });
}

export function suggestBudgetCompositionMatches(input: CompositionMatchInput): BudgetCompositionMatch[] {
  return findServiceCompositionCandidates(input).map((candidate) => ({
    id: `composition-match-${candidate.quantity.id}-${candidate.composition.id}`,
    quantityId: candidate.quantity.id,
    compositionId: candidate.composition.id,
    approvedByUser: false,
    confidence: confidenceFromScore(candidate.score),
    reason: candidate.reason,
    unitCompatible: candidate.score.unitCompatible,
    requiresReview: true,
  }));
}

export function scoreServiceCompositionCandidate(
  quantity: BudgetQuantity,
  composition: ServiceComposition,
  location?: CompositionMatchLocation
): ServiceCompositionCandidateScore {
  const textOverlap = calculateTextOverlap(quantity.description, composition.description);
  const tagOverlap = calculateTagOverlap(quantity.description, composition.tags);
  const unitCompatible = quantity.unit === composition.unit;
  const categoryCompatible = quantity.category === composition.category;
  const regionScore = calculateRegionScore(composition, location);
  const total = round(
    (unitCompatible ? 0.25 : 0) +
      (categoryCompatible ? 0.15 : 0) +
      regionScore +
      textOverlap * 0.3 +
      tagOverlap * 0.1,
    4
  );

  return {
    total,
    unitCompatible,
    categoryCompatible,
    regionScore,
    textOverlap,
    tagOverlap,
  };
}

function compareCandidates(a: ServiceCompositionCandidate, b: ServiceCompositionCandidate) {
  if (b.score.total !== a.score.total) return b.score.total - a.score.total;
  if (Number(b.score.unitCompatible) !== Number(a.score.unitCompatible)) {
    return Number(b.score.unitCompatible) - Number(a.score.unitCompatible);
  }
  return a.composition.description.localeCompare(b.composition.description);
}

function createCandidateReason(
  quantity: BudgetQuantity,
  composition: ServiceComposition,
  score: ServiceCompositionCandidateScore,
  location?: CompositionMatchLocation
) {
  const regionLabel = createRegionReason(composition, location);
  const unitLabel = score.unitCompatible ? "Unidade compativel." : `Unidade incompativel: ${quantity.unit} x ${composition.unit}.`;
  const categoryLabel = score.categoryCompatible ? "Categoria compativel." : "Categoria diferente; revisar.";
  const textLabel =
    score.textOverlap > 0 || score.tagOverlap > 0
      ? `Texto/tags com ${Math.round(Math.max(score.textOverlap, score.tagOverlap) * 100)}% de aderencia.`
      : "Texto sem aderencia forte; revisar manualmente.";

  return [unitLabel, categoryLabel, regionLabel, textLabel].join(" ");
}

function createRegionReason(composition: ServiceComposition, location?: CompositionMatchLocation) {
  if (!location?.state && !location?.city) return "Regiao do projeto nao informada.";
  const score = calculateRegionScore(composition, location);
  if (score >= 0.2) return `Fonte da cidade: ${composition.city}/${composition.state}.`;
  if (score >= 0.12) return `Fonte da UF: ${composition.state}.`;
  if (score > 0) return "Fonte nacional ou sem recorte local.";
  return "Fonte fora da regiao informada; revisar.";
}

function calculateRegionScore(composition: ServiceComposition, location?: CompositionMatchLocation) {
  if (!location) return 0;
  const projectState = normalizeRegion(normalizeBrazilStateName(location.state) || location.state);
  const projectCity = normalizeRegion(location.city);
  const sourceState = normalizeRegion(normalizeBrazilStateName(composition.state) || composition.state);
  const sourceCity = normalizeRegion(composition.city);

  if (!sourceState || sourceState === "brasil" || sourceState === "nacional" || sourceCity === "nacional") return 0.05;
  if (projectState && projectState === sourceState && projectCity && projectCity === sourceCity) return 0.2;
  if (projectState && projectState === sourceState) return 0.12;
  return 0;
}

function calculateTextOverlap(left: string, right: string) {
  const leftTerms = tokenize(left);
  const rightTerms = tokenize(right);
  if (leftTerms.size === 0 || rightTerms.size === 0) return 0;
  return intersectionSize(leftTerms, rightTerms) / leftTerms.size;
}

function calculateTagOverlap(description: string, tags: string[]) {
  const descriptionTerms = tokenize(description);
  const tagTerms = tokenize(tags.join(" "));
  if (descriptionTerms.size === 0 || tagTerms.size === 0) return 0;
  return intersectionSize(descriptionTerms, tagTerms) / descriptionTerms.size;
}

function tokenize(value: string) {
  const stopWords = new Set(["a", "as", "com", "da", "de", "do", "e", "em", "para", "por"]);
  const terms = normalizeRegion(value)
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3 && !stopWords.has(term));
  return new Set(terms);
}

function intersectionSize(left: Set<string>, right: Set<string>) {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count += 1;
  }
  return count;
}

function confidenceFromScore(score: ServiceCompositionCandidateScore): BudgetConfidenceLevel {
  if (!score.unitCompatible) return "low";
  if (score.total >= 0.75) return "high";
  if (score.total >= 0.5) return "medium";
  if (score.total >= 0.2) return "low";
  return "unverified";
}

function clampCandidateLimit(limit: number) {
  const normalizedLimit = Number.isFinite(limit) ? Math.floor(limit) : 10;
  return Math.min(20, Math.max(1, normalizedLimit));
}

function createLinkKey(quantityId: string, compositionId: string) {
  return `${quantityId}::${compositionId}`;
}

function normalizeRegion(value: string | undefined | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
