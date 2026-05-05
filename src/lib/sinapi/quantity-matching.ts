import type { BudgetConfidenceLevel, BudgetQuantity, ServiceComposition } from "@/lib/budget-assistant";
import type { ServiceBudgetCompositionLink } from "@/lib/budget-assistant/service-budget";
import { normalizeBrazilStateName } from "@/lib/locations/brazil";
import type { SinapiPriceStatus, SinapiRegime } from "./price-database";

export type SinapiMatchBlockReason =
  | "unit_incompatible"
  | "price_status"
  | "out_of_region"
  | "method_uncertain"
  | "missing_sinapi_metadata";

export interface SinapiQuantityMatchLocation {
  city?: string;
  state?: string;
}

export interface SinapiQuantityMatchInput {
  quantities: BudgetQuantity[];
  serviceCompositions: ServiceComposition[];
  location?: SinapiQuantityMatchLocation;
  referenceDate?: string;
  regime?: SinapiRegime;
  existingLinks?: ServiceBudgetCompositionLink[];
  maxCandidatesPerQuantity?: number;
}

export interface SinapiCandidateScore {
  total: number;
  methodCompatible: boolean;
  categoryCompatible: boolean;
  unitCompatible: boolean;
  stateComparable: boolean;
  stateCompatible: boolean;
  referenceCompatible: boolean;
  regimeCompatible: boolean;
  priceUsable: boolean;
  textOverlap: number;
  tagOverlap: number;
}

export interface SinapiQuantityMatchCandidate {
  candidateId: string;
  quantity: BudgetQuantity;
  composition: ServiceComposition;
  score: SinapiCandidateScore;
  confidence: BudgetConfidenceLevel;
  reason: string;
  pendingReason: string;
  requiresReview: boolean;
  approvalBlockedReason?: SinapiMatchBlockReason;
}

export interface SinapiQuantityMatch extends ServiceBudgetCompositionLink {
  confidence: BudgetConfidenceLevel;
  reason: string;
  pendingReason: string;
  unitCompatible: boolean;
  requiresReview: boolean;
  approvalBlockedReason?: SinapiMatchBlockReason;
  ai?: {
    confidence: BudgetConfidenceLevel;
    reason: string;
    pending: string;
  };
}

export interface SinapiAiCandidateDecision {
  id: string;
  confidence: BudgetConfidenceLevel;
  reason: string;
  pending: string;
}

export interface SinapiAiCandidateRankingResult {
  candidates: SinapiQuantityMatchCandidate[];
  decisions: SinapiAiCandidateDecision[];
  rejectedIds: string[];
}

export interface SinapiOpenAiRerankOptions {
  apiKey: string;
  model: string;
  fetcher?: typeof fetch;
  maxCandidates?: number;
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const maxAiCandidates = 20;
const supportedConfidence = new Set<BudgetConfidenceLevel>(["high", "medium", "low", "unverified"]);
const usablePriceStatuses = new Set<SinapiPriceStatus>(["valid"]);

export function findSinapiQuantityMatchCandidates(input: SinapiQuantityMatchInput): SinapiQuantityMatchCandidate[] {
  const maxCandidates = clampCandidateLimit(input.maxCandidatesPerQuantity ?? 10);
  const existingKeys = new Set((input.existingLinks ?? []).map((link) => createLinkKey(link.quantityId, link.compositionId)));

  return input.quantities.flatMap((quantity) => {
    const candidates = input.serviceCompositions
      .filter((composition) => composition.sinapi)
      .filter((composition) => !existingKeys.has(createLinkKey(quantity.id, composition.id)))
      .map((composition) => {
        const score = scoreSinapiQuantityCandidate(quantity, composition, input);
        const approvalBlockedReason = getSinapiMatchBlockReason(score, composition);
        const requiresReview = Boolean(approvalBlockedReason) || composition.requiresReview || score.total < 0.8;
        const confidence = confidenceFromSinapiScore(score, approvalBlockedReason);
        return {
          candidateId: createLinkKey(quantity.id, composition.id),
          quantity,
          composition,
          score,
          confidence,
          reason: createSinapiCandidateReason(quantity, composition, score, input),
          pendingReason: createSinapiPendingReason(composition, approvalBlockedReason),
          requiresReview,
          approvalBlockedReason,
        };
      })
      .filter((candidate) => candidate.score.total >= 0.25)
      .sort(compareSinapiCandidates);

    return candidates.slice(0, maxCandidates);
  });
}

export function suggestSinapiQuantityMatches(input: SinapiQuantityMatchInput): SinapiQuantityMatch[] {
  return findSinapiQuantityMatchCandidates(input).map(createSinapiQuantityMatch);
}

export function scoreSinapiQuantityCandidate(
  quantity: BudgetQuantity,
  composition: ServiceComposition,
  input: Pick<SinapiQuantityMatchInput, "location" | "referenceDate" | "regime"> = {}
): SinapiCandidateScore {
  const sinapi = composition.sinapi;
  const projectState = normalizeState(input.location?.state);
  const sourceState = normalizeState(sinapi?.state ?? composition.state);
  const methodCompatible = quantity.constructionMethod === composition.constructionMethod;
  const categoryCompatible = quantity.category === composition.category;
  const unitCompatible = quantity.unit === composition.unit;
  const stateComparable = Boolean(projectState && sourceState);
  const stateCompatible = stateComparable ? projectState === sourceState : false;
  const referenceCompatible = Boolean(input.referenceDate && sinapi?.referenceDate === input.referenceDate);
  const regimeCompatible = Boolean(input.regime && sinapi?.regime === input.regime);
  const priceUsable = Boolean(sinapi && usablePriceStatuses.has(sinapi.priceStatus));
  const textOverlap = calculateTextOverlap(quantity.description, composition.description);
  const tagOverlap = calculateTagOverlap(quantity.description, composition.tags);

  const total = round(
      (methodCompatible ? 0.14 : -0.1) +
      (categoryCompatible ? 0.1 : 0) +
      (unitCompatible ? 0.18 : -0.16) +
      (projectState ? (stateCompatible ? 0.18 : -0.12) : 0) +
      (referenceCompatible ? 0.1 : input.referenceDate ? -0.04 : 0) +
      (regimeCompatible ? 0.08 : input.regime ? -0.04 : 0) +
      (priceUsable ? 0.12 : -0.18) +
      textOverlap * 0.25 +
      tagOverlap * 0.15,
    4
  );

  return {
    total,
    methodCompatible,
    categoryCompatible,
    unitCompatible,
    stateComparable,
    stateCompatible,
    referenceCompatible,
    regimeCompatible,
    priceUsable,
    textOverlap,
    tagOverlap,
  };
}

export function createSinapiQuantityMatch(candidate: SinapiQuantityMatchCandidate): SinapiQuantityMatch {
  return {
    id: `sinapi-match-${candidate.quantity.id}-${candidate.composition.id}`,
    quantityId: candidate.quantity.id,
    compositionId: candidate.composition.id,
    approvedByUser: false,
    confidence: candidate.confidence,
    reason: candidate.reason,
    pendingReason: candidate.pendingReason,
    unitCompatible: candidate.score.unitCompatible,
    requiresReview: true,
    approvalBlockedReason: candidate.approvalBlockedReason,
  };
}

export function applySinapiAiCandidateRanking(
  candidates: SinapiQuantityMatchCandidate[],
  decisions: unknown,
  maxCandidates = maxAiCandidates
): SinapiAiCandidateRankingResult {
  const parsedDecisions = parseAiDecisions(decisions);
  const candidatesById = createAiCandidateLookup(candidates);
  const ranked: SinapiQuantityMatchCandidate[] = [];
  const rejectedIds: string[] = [];
  const acceptedDecisions: SinapiAiCandidateDecision[] = [];

  for (const decision of parsedDecisions) {
    const candidate = candidatesById.get(decision.id);
    if (!candidate) {
      rejectedIds.push(decision.id);
      continue;
    }
    if (ranked.some((item) => item.candidateId === candidate.candidateId)) continue;

    ranked.push({
      ...candidate,
      confidence: combineConfidence(candidate.confidence, decision.confidence),
      reason: `${candidate.reason} OpenAI: ${decision.reason}`,
      pendingReason: [candidate.pendingReason, decision.pending].filter(Boolean).join(" "),
      requiresReview: true,
    });
    acceptedDecisions.push(decision);
  }

  const rankedIds = new Set(ranked.map((candidate) => candidate.candidateId));
  const remaining = candidates.filter((candidate) => !rankedIds.has(candidate.candidateId));

  return {
    candidates: [...ranked, ...remaining].slice(0, clampCandidateLimit(maxCandidates)),
    decisions: acceptedDecisions,
    rejectedIds,
  };
}

export async function rankSinapiQuantityCandidatesWithOpenAi(
  candidates: SinapiQuantityMatchCandidate[],
  options: SinapiOpenAiRerankOptions
): Promise<SinapiAiCandidateRankingResult> {
  const limitedCandidates = candidates.slice(0, clampCandidateLimit(options.maxCandidates ?? maxAiCandidates));
  if (limitedCandidates.length === 0) {
    return { candidates: [], decisions: [], rejectedIds: [] };
  }
  if (!options.apiKey.trim()) {
    throw new Error("OPENAI_API_KEY nao configurada para ranking SINAPI.");
  }

  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Voce ajuda a reordenar candidatos SINAPI existentes. Retorne JSON com array candidates. Nunca crie IDs, precos, composicoes, H/H, perdas, BDI ou aprovacao.",
        },
        {
          role: "user",
          content: JSON.stringify({
            schema: {
              candidates: [{ id: "string", confidence: "high|medium|low|unverified", reason: "string", pending: "string" }],
            },
            candidates: limitedCandidates.map(toAiCandidatePayload),
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI nao conseguiu reordenar candidatos SINAPI: HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as OpenAiChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI retornou ranking SINAPI vazio.");

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    throw new Error("OpenAI retornou JSON invalido para ranking SINAPI.");
  }

  return applySinapiAiCandidateRanking(limitedCandidates, parsedContent, options.maxCandidates);
}

function createAiCandidateLookup(candidates: SinapiQuantityMatchCandidate[]) {
  const lookup = new Map<string, SinapiQuantityMatchCandidate>();

  for (const candidate of candidates) {
    lookup.set(candidate.candidateId, candidate);
  }

  return lookup;
}

function compareSinapiCandidates(a: SinapiQuantityMatchCandidate, b: SinapiQuantityMatchCandidate) {
  if (b.score.total !== a.score.total) return b.score.total - a.score.total;
  if (Number(b.score.unitCompatible) !== Number(a.score.unitCompatible)) return Number(b.score.unitCompatible) - Number(a.score.unitCompatible);
  if (Number(b.score.priceUsable) !== Number(a.score.priceUsable)) return Number(b.score.priceUsable) - Number(a.score.priceUsable);
  return a.composition.description.localeCompare(b.composition.description);
}

function getSinapiMatchBlockReason(score: SinapiCandidateScore, composition: ServiceComposition): SinapiMatchBlockReason | undefined {
  if (!composition.sinapi) return "missing_sinapi_metadata";
  if (!score.unitCompatible) return "unit_incompatible";
  if (!score.methodCompatible) return "method_uncertain";
  if (composition.sinapi.priceStatus === "out_of_region" || (score.stateComparable && !score.stateCompatible)) return "out_of_region";
  if (!score.priceUsable) return "price_status";
  return undefined;
}

function createSinapiCandidateReason(
  quantity: BudgetQuantity,
  composition: ServiceComposition,
  score: SinapiCandidateScore,
  input: Pick<SinapiQuantityMatchInput, "location" | "referenceDate" | "regime">
) {
  const sinapi = composition.sinapi;
  const parts = [
    score.unitCompatible ? "Unidade compativel." : `Unidade incompativel: ${quantity.unit} x ${composition.unit}.`,
    score.methodCompatible ? "Metodo compativel." : "Metodo construtivo incerto; revisar.",
    score.categoryCompatible ? "Categoria compativel." : "Categoria diferente; revisar.",
    createStateReason(input.location, composition, score),
    score.referenceCompatible || !input.referenceDate ? `Referencia: ${sinapi?.referenceDate || composition.referenceDate || "ausente"}.` : "Referencia diferente; revisar.",
    score.regimeCompatible || !input.regime ? `Regime: ${sinapi?.regime ?? "unknown"}.` : "Regime diferente; revisar.",
    score.priceUsable ? "Preco SINAPI valido." : `Preco pendente: ${sinapi?.priceStatus ?? "sem metadado"}.`,
    Math.max(score.textOverlap, score.tagOverlap) > 0
      ? `Texto/tags com ${Math.round(Math.max(score.textOverlap, score.tagOverlap) * 100)}% de aderencia.`
      : "Texto sem aderencia forte; revisar.",
  ];
  return parts.join(" ");
}

function createSinapiPendingReason(composition: ServiceComposition, blockReason?: SinapiMatchBlockReason) {
  const sinapi = composition.sinapi;
  if (!blockReason) return "Aguardando aprovacao humana do vinculo.";
  if (blockReason === "unit_incompatible") return "Unidade incompativel bloqueia aprovacao automatica.";
  if (blockReason === "method_uncertain") return "Metodo construtivo incerto; manter vinculo pendente.";
  if (blockReason === "out_of_region") return "Fonte SINAPI fora da UF selecionada; manter pendente.";
  if (blockReason === "price_status") return `Status de preco ${sinapi?.priceStatus ?? "ausente"}; manter pendente.`;
  return "Metadados SINAPI ausentes; manter pendente.";
}

function createStateReason(location: SinapiQuantityMatchLocation | undefined, composition: ServiceComposition, score: SinapiCandidateScore) {
  if (score.stateCompatible) return `UF compativel: ${composition.sinapi?.state ?? composition.state}.`;
  if (!score.stateComparable) return createMissingStateReason(composition);
  return createStateMismatchReason(location, composition);
}

function createMissingStateReason(composition: ServiceComposition) {
  const compositionState = composition.sinapi?.state ?? composition.state ?? "ausente";
  return `UF do projeto ausente; fonte ${compositionState} precisa revisao.`;
}

function createStateMismatchReason(location: SinapiQuantityMatchLocation | undefined, composition: ServiceComposition) {
  const projectState = normalizeBrazilStateName(location?.state) || location?.state || "UF ausente";
  const compositionState = composition.sinapi?.state ?? composition.state ?? "ausente";
  return `UF diferente: projeto ${projectState}, fonte ${compositionState}.`;
}

function confidenceFromSinapiScore(score: SinapiCandidateScore, blockReason?: SinapiMatchBlockReason): BudgetConfidenceLevel {
  if (blockReason) return "low";
  if (score.total >= 0.85) return "high";
  if (score.total >= 0.65) return "medium";
  if (score.total >= 0.25) return "low";
  return "unverified";
}

function parseAiDecisions(value: unknown): SinapiAiCandidateDecision[] {
  const candidates = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.candidates) ? value.candidates : [];
  return candidates.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const id = readText(candidate.id);
    if (!id) return [];
    const confidence = normalizeConfidence(candidate.confidence);
    return [
      {
        id,
        confidence,
        reason: readText(candidate.reason) || "OpenAI sugeriu este candidato existente.",
        pending: readText(candidate.pending),
      },
    ];
  });
}

function combineConfidence(current: BudgetConfidenceLevel, suggested: BudgetConfidenceLevel): BudgetConfidenceLevel {
  const order: BudgetConfidenceLevel[] = ["unverified", "low", "medium", "high"];
  return order[Math.min(order.indexOf(current), order.indexOf(suggested))] ?? "unverified";
}

function toAiCandidatePayload(candidate: SinapiQuantityMatchCandidate) {
  const sinapi = candidate.composition.sinapi;
  return {
    id: candidate.candidateId,
    compositionId: candidate.composition.id,
    quantityId: candidate.quantity.id,
    code: sinapi?.code ?? candidate.composition.serviceCode,
    quantity: {
      id: candidate.quantity.id,
      description: candidate.quantity.description,
      unit: candidate.quantity.unit,
      category: candidate.quantity.category,
      method: candidate.quantity.constructionMethod,
    },
    composition: {
      description: candidate.composition.description,
      unit: candidate.composition.unit,
      category: candidate.composition.category,
      method: candidate.composition.constructionMethod,
      state: sinapi?.state ?? candidate.composition.state,
      referenceDate: sinapi?.referenceDate ?? candidate.composition.referenceDate,
      regime: sinapi?.regime ?? "unknown",
      priceStatus: sinapi?.priceStatus ?? "requires_review",
      tags: candidate.composition.tags.slice(0, 8),
    },
    deterministicScore: candidate.score.total,
    pending: candidate.pendingReason,
  };
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
  return new Set(
    normalizeText(value)
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3 && !stopWords.has(term))
  );
}

function intersectionSize(left: Set<string>, right: Set<string>) {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count += 1;
  }
  return count;
}

function normalizeState(value: string | undefined | null) {
  return normalizeText(normalizeBrazilStateName(value) || value || "");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeConfidence(value: unknown): BudgetConfidenceLevel {
  const confidence = readText(value) as BudgetConfidenceLevel;
  return supportedConfidence.has(confidence) ? confidence : "unverified";
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampCandidateLimit(limit: number) {
  const normalizedLimit = Number.isFinite(limit) ? Math.floor(limit) : 10;
  return Math.min(maxAiCandidates, Math.max(1, normalizedLimit));
}

function createLinkKey(quantityId: string, compositionId: string) {
  return `${quantityId}::${compositionId}`;
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
