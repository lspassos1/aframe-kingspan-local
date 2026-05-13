import {
  evaluateServiceCompositionPriceQuality,
  findServiceCompositionCandidates,
  type BudgetQuantity,
  type PriceSource,
  type ServiceComposition,
} from "@/lib/budget-assistant";
import type { CompositionMatchLocation } from "@/lib/budget-assistant/composition-matching";
import type { ServiceBudgetCompositionLink } from "@/lib/budget-assistant/service-budget";
import type { PriceCandidate, PriceCandidateSearchInput, PriceResolutionCandidate, PriceResolverResult } from "./price-candidate-types";
import { createDisabledRemotePriceDbAdapter, type RemotePriceDbAdapter } from "./remote-price-db";

export interface PriceResolverInput {
  quantities: BudgetQuantity[];
  priceSources?: PriceSource[];
  serviceCompositions: ServiceComposition[];
  approvedLinks?: ServiceBudgetCompositionLink[];
  location?: CompositionMatchLocation;
  referenceMonth?: string;
  regime?: PriceCandidateSearchInput["regime"];
  remoteDb?: RemotePriceDbAdapter;
  maxCandidatesPerQuantity?: number;
}

export async function resolvePriceCandidates(input: PriceResolverInput): Promise<PriceResolverResult> {
  const remoteDb = input.remoteDb ?? createDisabledRemotePriceDbAdapter();
  const approved = createApprovedProjectCandidates(input);
  const imported = createImportedProjectCandidates(input, approved);
  const remote = await createRemoteCandidates(input, remoteDb);
  const manual = createManualEntryCandidates(input.quantities);

  return {
    candidates: [...approved, ...imported, ...remote.candidates, ...manual],
    remote: {
      configured: remote.configured,
      searched: remote.searched,
      candidates: remote.remoteCandidates,
      error: remote.error,
    },
    manualEntryAvailable: true,
    futureExternalApiAvailable: false,
    futureAiMarketSuggestionAvailable: false,
  };
}

function createApprovedProjectCandidates(input: PriceResolverInput): PriceResolutionCandidate[] {
  const quantitiesById = new Map(input.quantities.map((quantity) => [quantity.id, quantity]));
  const compositionsById = new Map(input.serviceCompositions.map((composition) => [composition.id, composition]));
  const sourceTypeById = new Map((input.priceSources ?? []).map((source) => [source.id, source.type]));
  const candidates: PriceResolutionCandidate[] = [];
  const hasPriceSources = Boolean(input.priceSources?.length);

  for (const link of input.approvedLinks ?? []) {
    const quantity = quantitiesById.get(link.quantityId);
    const composition = compositionsById.get(link.compositionId);
    if (!quantity || !composition) continue;
    if (!link.approvedByUser && !isManualProjectComposition(composition, sourceTypeById, hasPriceSources)) continue;

    const quality = evaluateServiceCompositionPriceQuality(composition, {
      expectedState: input.location?.state,
      expectedUnit: quantity.unit,
      candidateApprovedByUser: link.approvedByUser,
    });

    candidates.push({
      id: `project-approved-${quantity.id}-${composition.id}`,
      priority: 1,
      origin: "project-approved",
      label: link.approvedByUser ? "Preço aprovado no projeto" : "Preço manual do projeto",
      quantityId: quantity.id,
      compositionId: composition.id,
      approvedByUser: link.approvedByUser,
      requiresReview: quality.requiresReview,
      unitCompatible: quantity.unit === composition.unit,
      quality,
      qualityIssues: quality.issues,
    });
  }

  return candidates;
}

function createImportedProjectCandidates(input: PriceResolverInput, approvedCandidates: PriceResolutionCandidate[]): PriceResolutionCandidate[] {
  const approvedKeys = new Set(approvedCandidates.map((candidate) => createQuantityCompositionKey(candidate.quantityId, candidate.compositionId)));

  return findServiceCompositionCandidates({
    quantities: input.quantities,
    serviceCompositions: input.serviceCompositions,
    location: input.location,
    existingLinks: (input.approvedLinks ?? []).filter((link) => approvedKeys.has(createQuantityCompositionKey(link.quantityId, link.compositionId))),
    maxCandidatesPerQuantity: input.maxCandidatesPerQuantity,
  }).map((candidate) => {
    const quality = evaluateServiceCompositionPriceQuality(candidate.composition, {
      expectedState: input.location?.state,
      expectedUnit: candidate.quantity.unit,
      candidateApprovedByUser: false,
    });

    return {
      id: `project-imported-${candidate.quantity.id}-${candidate.composition.id}`,
      priority: 2,
      origin: "project-imported",
      label: "Base local/importada do projeto",
      quantityId: candidate.quantity.id,
      compositionId: candidate.composition.id,
      approvedByUser: false,
      requiresReview: true,
      unitCompatible: candidate.score.unitCompatible,
      quality,
      qualityIssues: quality.issues,
    };
  });
}

async function createRemoteCandidates(input: PriceResolverInput, remoteDb: RemotePriceDbAdapter) {
  if (!remoteDb.isConfigured()) {
    return {
      configured: false,
      searched: false,
      remoteCandidates: [] as PriceCandidate[],
      candidates: [] as PriceResolutionCandidate[],
      error: "Remote price database is not configured.",
    };
  }

  const remoteCandidates: PriceCandidate[] = [];
  const resolvedCandidates: PriceResolutionCandidate[] = [];
  let error: string | undefined;

  for (const quantity of input.quantities) {
    let result;
    try {
      result = await remoteDb.searchCandidates({
        query: quantity.description,
        state: input.location?.state ?? "",
        referenceMonth: input.referenceMonth,
        regime: input.regime,
        unit: quantity.unit,
        category: quantity.category,
        constructionMethod: quantity.constructionMethod,
        limit: input.maxCandidatesPerQuantity,
      });
    } catch (searchError) {
      if (!error) error = getRemoteSearchErrorMessage(searchError);
      continue;
    }

    if (result.error && !error) error = result.error;
    remoteCandidates.push(...result.candidates);
    resolvedCandidates.push(
      ...result.candidates.map((candidate) => ({
        id: `remote-db-${quantity.id}-${candidate.id}`,
        priority: 3,
        origin: "remote-db" as const,
        label: "Base central candidata",
        quantityId: quantity.id,
        approvedByUser: false,
        requiresReview: true,
        unitCompatible: quantity.unit === candidate.unit,
        remoteCandidate: candidate,
        quality: candidate.quality,
        qualityIssues: candidate.quality.issues,
      }))
    );
  }

  return {
    configured: true,
    searched: true,
    remoteCandidates,
    candidates: resolvedCandidates,
    error,
  };
}

function createManualEntryCandidates(quantities: BudgetQuantity[]): PriceResolutionCandidate[] {
  return quantities.map((quantity) => ({
    id: `manual-entry-${quantity.id}`,
    priority: 4,
    origin: "manual-entry",
    label: "Preenchimento manual disponível",
    quantityId: quantity.id,
    approvedByUser: false,
    requiresReview: true,
    qualityIssues: [],
  }));
}

function isManualProjectComposition(composition: ServiceComposition, sourceTypeById: Map<string, PriceSource["type"]>, hasPriceSources: boolean) {
  if (sourceTypeById.get(composition.sourceId) === "manual") return true;
  if (hasPriceSources) return false;
  return hasManualCompositionMarker(composition);
}

function hasManualCompositionMarker(composition: ServiceComposition) {
  const sourceId = composition.sourceId.trim().toLowerCase();
  const sourceCode = composition.sourceCode.trim().toUpperCase();
  const serviceCode = composition.serviceCode.trim().toUpperCase();
  return sourceId.startsWith("manual-") || sourceCode === "MANUAL" || sourceCode.startsWith("MANUAL-") || serviceCode === "MANUAL" || serviceCode.startsWith("MANUAL-");
}

function getRemoteSearchErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return `Remote price database search failed: ${error.message}`;
  return "Remote price database search failed.";
}

function createQuantityCompositionKey(quantityId?: string, compositionId?: string) {
  return `${quantityId ?? ""}::${compositionId ?? ""}`;
}
