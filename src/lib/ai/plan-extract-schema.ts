import { z } from "zod";

export const planExtractConfidenceSchema = z.enum(["low", "medium", "high"]);

export const planExtractValueConfidenceSchema = z.enum(["low", "medium", "high", "unknown"]);

export const planExtractValueSourceSchema = z.enum(["visible", "calculated", "estimated_rule", "user_confirmed", "manual"]);

export const planExtractQuantitySeedSourceSchema = z.enum(["ai_visible", "system_calculated", "rule_estimated", "user_confirmed", "manual"]);

export const planExtractQuantitySeedCategorySchema = z.enum([
  "foundation",
  "walls",
  "openings",
  "flooring",
  "finishes",
  "roof",
  "electrical",
  "plumbing",
  "structure",
  "external",
]);

export const planExtractQuantitySeedUnitSchema = z.enum(["m", "m2", "m3", "un", "kg"]);

export const planExtractConstructionMethodSchema = z.enum(["aframe", "conventional-masonry", "eco-block", "monolithic-eps"]);

const aiGeneratedSources = new Set(["visible", "calculated", "estimated_rule"]);
const aiGeneratedQuantitySources = new Set(["ai_visible", "system_calculated", "rule_estimated"]);

function createExtractedValueSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z
    .object({
      value: valueSchema,
      unit: z.string().trim().min(1).max(24).default("un"),
      confidence: planExtractValueConfidenceSchema,
      evidence: z.string().trim().min(1).max(700),
      source: planExtractValueSourceSchema,
      requiresReview: z.boolean(),
      pendingReason: z.string().trim().min(1).max(400).optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (aiGeneratedSources.has(value.source) && !value.requiresReview) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requiresReview"],
          message: "AI extracted values must require human review.",
        });
      }
      if ((value.confidence === "low" || value.confidence === "unknown" || value.source === "estimated_rule") && !value.pendingReason) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pendingReason"],
          message: "Low confidence, unknown confidence and rule estimates must include a pending item.",
        });
      }
    });
}

const extractedTextValueSchema = createExtractedValueSchema(z.string().trim().min(1).max(800));
const extractedShortTextValueSchema = createExtractedValueSchema(z.string().trim().min(1).max(160));
const extractedPositiveNumberValueSchema = createExtractedValueSchema(z.number().positive());
const extractedNonNegativeNumberValueSchema = createExtractedValueSchema(z.number().nonnegative());
const extractedBooleanValueSchema = createExtractedValueSchema(z.boolean());

export const planExtractQuestionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  question: z.string().trim().min(1).max(400),
  target: z.string().trim().min(1).max(80).optional(),
  reason: z.string().trim().min(1).max(400).optional(),
  requiredBeforeBudget: z.boolean().default(true),
});

export const planExtractWarningSchema = z.object({
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  target: z.string().trim().min(1).max(80).optional(),
});

export const planExtractQuantitySeedSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    category: planExtractQuantitySeedCategorySchema,
    description: z.string().trim().min(1).max(500),
    quantity: z.number().positive(),
    unit: planExtractQuantitySeedUnitSchema,
    source: planExtractQuantitySeedSourceSchema,
    confidence: planExtractConfidenceSchema,
    requiresReview: z.boolean(),
    evidence: z.string().trim().min(1).max(700).optional(),
    pendingReason: z.string().trim().min(1).max(400).optional(),
    notes: z.string().trim().max(600).default(""),
  })
  .strict()
  .superRefine((seed, context) => {
    if (aiGeneratedQuantitySources.has(seed.source) && !seed.requiresReview) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requiresReview"],
        message: "AI or system generated quantity seeds must require human review.",
      });
    }
    if ((seed.confidence === "low" || seed.source === "rule_estimated") && !seed.pendingReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pendingReason"],
        message: "Low confidence and rule estimated quantity seeds must include a pending item.",
      });
    }
  });

const planExtractDocumentSchema = z.object({
  type: extractedShortTextValueSchema.optional(),
  title: extractedTextValueSchema.optional(),
  revision: extractedShortTextValueSchema.optional(),
  pageCount: extractedPositiveNumberValueSchema.optional(),
  sheet: extractedShortTextValueSchema.optional(),
  level: extractedShortTextValueSchema.optional(),
  legendNotes: z.array(extractedTextValueSchema).optional(),
});

const planExtractScaleSchema = z.object({
  scaleText: extractedShortTextValueSchema.optional(),
  ratio: extractedPositiveNumberValueSchema.optional(),
  unit: extractedShortTextValueSchema.optional(),
  referenceMeasureM: extractedPositiveNumberValueSchema.optional(),
  needsReferenceQuestion: z.boolean().optional(),
});

const planExtractLocationSchema = z.object({
  country: extractedShortTextValueSchema.optional(),
  state: extractedShortTextValueSchema.optional(),
  city: extractedShortTextValueSchema.optional(),
  neighborhood: extractedShortTextValueSchema.optional(),
  address: extractedTextValueSchema.optional(),
  postalCode: extractedShortTextValueSchema.optional(),
});

const planExtractBuildingSchema = z.object({
  lotWidthM: extractedPositiveNumberValueSchema.optional(),
  lotDepthM: extractedPositiveNumberValueSchema.optional(),
  lotAreaM2: extractedPositiveNumberValueSchema.optional(),
  setbackFrontM: extractedNonNegativeNumberValueSchema.optional(),
  setbackBackM: extractedNonNegativeNumberValueSchema.optional(),
  setbackLeftM: extractedNonNegativeNumberValueSchema.optional(),
  setbackRightM: extractedNonNegativeNumberValueSchema.optional(),
  builtAreaM2: extractedPositiveNumberValueSchema.optional(),
  footprintAreaM2: extractedPositiveNumberValueSchema.optional(),
  widthM: extractedPositiveNumberValueSchema.optional(),
  depthM: extractedPositiveNumberValueSchema.optional(),
  perimeterM: extractedPositiveNumberValueSchema.optional(),
  floorHeightM: extractedPositiveNumberValueSchema.optional(),
  floors: extractedPositiveNumberValueSchema.optional(),
  constructionMethodSuggestion: extractedShortTextValueSchema.optional(),
});

const planExtractLotSchema = z.object({
  areaM2: extractedPositiveNumberValueSchema.optional(),
  widthM: extractedPositiveNumberValueSchema.optional(),
  depthM: extractedPositiveNumberValueSchema.optional(),
  frontSetbackM: extractedNonNegativeNumberValueSchema.optional(),
  backSetbackM: extractedNonNegativeNumberValueSchema.optional(),
  leftSetbackM: extractedNonNegativeNumberValueSchema.optional(),
  rightSetbackM: extractedNonNegativeNumberValueSchema.optional(),
  implantationNotes: z.array(extractedTextValueSchema).optional(),
});

const planExtractRoomSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: extractedShortTextValueSchema.optional(),
  type: extractedShortTextValueSchema.optional(),
  floor: extractedNonNegativeNumberValueSchema.optional(),
  areaM2: extractedPositiveNumberValueSchema.optional(),
  widthM: extractedPositiveNumberValueSchema.optional(),
  depthM: extractedPositiveNumberValueSchema.optional(),
  ceilingHeightM: extractedPositiveNumberValueSchema.optional(),
  wetArea: extractedBooleanValueSchema.optional(),
  floorFinish: extractedShortTextValueSchema.optional(),
  wallFinish: extractedShortTextValueSchema.optional(),
  ceilingFinish: extractedShortTextValueSchema.optional(),
});

const planExtractWallsSchema = z.object({
  externalLengthM: extractedPositiveNumberValueSchema.optional(),
  internalLengthM: extractedPositiveNumberValueSchema.optional(),
  hydraulicWallLengthM: extractedNonNegativeNumberValueSchema.optional(),
  thicknessM: extractedPositiveNumberValueSchema.optional(),
  grossAreaM2: extractedPositiveNumberValueSchema.optional(),
  openingAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  netAreaM2: extractedPositiveNumberValueSchema.optional(),
  notes: z.array(extractedTextValueSchema).optional(),
});

const planExtractOpeningItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  roomId: z.string().trim().min(1).max(120).optional(),
  type: extractedShortTextValueSchema.optional(),
  widthM: extractedPositiveNumberValueSchema.optional(),
  heightM: extractedPositiveNumberValueSchema.optional(),
  quantity: extractedPositiveNumberValueSchema.optional(),
  position: extractedShortTextValueSchema.optional(),
});

const planExtractOpeningsSchema = z.object({
  doors: z.array(planExtractOpeningItemSchema).optional(),
  windows: z.array(planExtractOpeningItemSchema).optional(),
  doorCount: extractedNonNegativeNumberValueSchema.optional(),
  windowCount: extractedNonNegativeNumberValueSchema.optional(),
});

const planExtractFloorFinishesSchema = z.object({
  dryAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  wetAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  externalAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  wallTileAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  paintingAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  ceilingAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  finishLevel: extractedShortTextValueSchema.optional(),
});

const planExtractWallFinishesSchema = z.object({
  internalCoatingAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  externalCoatingAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  wetAreaWallTileM2: extractedNonNegativeNumberValueSchema.optional(),
  notes: z.array(extractedTextValueSchema).optional(),
});

const planExtractPaintingSchema = z.object({
  internalPaintingAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  externalPaintingAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  ceilingPaintingAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  notes: z.array(extractedTextValueSchema).optional(),
});

const planExtractCeilingSchema = z.object({
  ceilingAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  liningType: extractedShortTextValueSchema.optional(),
  hasCeilingPlan: extractedBooleanValueSchema.optional(),
  notes: z.array(extractedTextValueSchema).optional(),
});

const planExtractRoofSchema = z.object({
  type: extractedShortTextValueSchema.optional(),
  projectionAreaM2: extractedPositiveNumberValueSchema.optional(),
  roofAreaM2: extractedPositiveNumberValueSchema.optional(),
  slopePercent: extractedNonNegativeNumberValueSchema.optional(),
  eaveM: extractedNonNegativeNumberValueSchema.optional(),
  hasRoofPlan: extractedBooleanValueSchema.optional(),
});

const planExtractFoundationSchema = z.object({
  visibleType: extractedShortTextValueSchema.optional(),
  preliminaryType: extractedShortTextValueSchema.optional(),
  requiresEngineerReview: z.boolean().default(true),
  notes: z.array(extractedTextValueSchema).optional(),
});

const planExtractStructureSchema = z.object({
  visibleSystem: extractedShortTextValueSchema.optional(),
  structuralElementsVisible: z.array(extractedTextValueSchema).optional(),
  requiresEngineerReview: z.boolean().default(true),
  notes: z.array(extractedTextValueSchema).optional(),
});

const planExtractPointSchema = z.object({
  id: z.string().trim().min(1).max(120),
  roomId: z.string().trim().min(1).max(120).optional(),
  type: extractedShortTextValueSchema.optional(),
  quantity: extractedPositiveNumberValueSchema.optional(),
  evidence: z.string().trim().min(1).max(700).optional(),
});

const planExtractElectricalSchema = z.object({
  hasElectricalPlan: extractedBooleanValueSchema.optional(),
  visiblePoints: z.array(planExtractPointSchema).optional(),
  estimatedLightPoints: extractedNonNegativeNumberValueSchema.optional(),
  estimatedSwitches: extractedNonNegativeNumberValueSchema.optional(),
  estimatedOutlets: extractedNonNegativeNumberValueSchema.optional(),
  estimatedByAverage: extractedBooleanValueSchema.optional(),
});

const planExtractPlumbingSchema = z.object({
  hasPlumbingPlan: extractedBooleanValueSchema.optional(),
  wetRooms: z.array(z.string().trim().min(1).max(120)).optional(),
  visiblePoints: z.array(planExtractPointSchema).optional(),
  estimatedColdWaterPoints: extractedNonNegativeNumberValueSchema.optional(),
  estimatedSewagePoints: extractedNonNegativeNumberValueSchema.optional(),
  estimatedByAverage: extractedBooleanValueSchema.optional(),
});

const planExtractFixturesSchema = z.object({
  toilets: extractedNonNegativeNumberValueSchema.optional(),
  sinks: extractedNonNegativeNumberValueSchema.optional(),
  showers: extractedNonNegativeNumberValueSchema.optional(),
  faucets: extractedNonNegativeNumberValueSchema.optional(),
  tanks: extractedNonNegativeNumberValueSchema.optional(),
  notes: z.array(extractedTextValueSchema).optional(),
});

const planExtractExteriorSchema = z.object({
  pavedAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  landscapeAreaM2: extractedNonNegativeNumberValueSchema.optional(),
  boundaryWallLengthM: extractedNonNegativeNumberValueSchema.optional(),
  drivewayAreaM2: extractedNonNegativeNumberValueSchema.optional(),
});

const planExtractProviderMetaSchema = z.object({
  provider: z.string(),
  model: z.string(),
  tokens: z.number().int().nonnegative().optional(),
});

export const planExtractResultSchema = z.object({
  version: z.literal("1.0"),
  summary: z.string().max(800),
  confidence: planExtractConfidenceSchema,
  extractionStatus: z.enum(["complete", "partial", "insufficient"]).optional(),
  extracted: z.object({
    projectName: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    constructionMethod: planExtractConstructionMethodSchema.optional(),
    terrainWidthM: z.number().positive().optional(),
    terrainDepthM: z.number().positive().optional(),
    houseWidthM: z.number().positive().optional(),
    houseDepthM: z.number().positive().optional(),
    builtAreaM2: z.number().positive().optional(),
    floorHeightM: z.number().positive().optional(),
    floors: z.number().int().positive().optional(),
    doorCount: z.number().int().nonnegative().optional(),
    windowCount: z.number().int().nonnegative().optional(),
    notes: z.array(z.string()).default([]),
  }),
  fieldConfidence: z.record(z.string(), planExtractConfidenceSchema).default({}),
  fieldEvidence: z.record(z.string(), z.string().trim().min(1).max(700)).optional(),
  document: planExtractDocumentSchema.optional(),
  scale: planExtractScaleSchema.optional(),
  location: planExtractLocationSchema.optional(),
  lot: planExtractLotSchema.optional(),
  building: planExtractBuildingSchema.optional(),
  rooms: z.array(planExtractRoomSchema).optional(),
  walls: planExtractWallsSchema.optional(),
  openings: planExtractOpeningsSchema.optional(),
  floorFinishes: planExtractFloorFinishesSchema.optional(),
  wallFinishes: planExtractWallFinishesSchema.optional(),
  painting: planExtractPaintingSchema.optional(),
  ceiling: planExtractCeilingSchema.optional(),
  roof: planExtractRoofSchema.optional(),
  foundation: planExtractFoundationSchema.optional(),
  structure: planExtractStructureSchema.optional(),
  electrical: planExtractElectricalSchema.optional(),
  plumbing: planExtractPlumbingSchema.optional(),
  fixtures: planExtractFixturesSchema.optional(),
  exterior: planExtractExteriorSchema.optional(),
  quantitySeeds: z.array(planExtractQuantitySeedSchema).optional(),
  questions: z.array(planExtractQuestionSchema).optional(),
  extractionWarnings: z.array(planExtractWarningSchema).optional(),
  assumptions: z.array(z.string()).default([]),
  missingInformation: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  providerMeta: planExtractProviderMetaSchema.optional(),
}).strict();

export type PlanExtractConfidence = z.infer<typeof planExtractConfidenceSchema>;
export type PlanExtractValueConfidence = z.infer<typeof planExtractValueConfidenceSchema>;
export type PlanExtractValueSource = z.infer<typeof planExtractValueSourceSchema>;
export type PlanExtractQuantitySeed = z.infer<typeof planExtractQuantitySeedSchema>;
export type PlanExtractQuestion = z.infer<typeof planExtractQuestionSchema>;
export type PlanExtractWarning = z.infer<typeof planExtractWarningSchema>;
export type PlanExtractResult = z.infer<typeof planExtractResultSchema>;

export function stripJsonCodeFence(value: string) {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch?.[1]?.trim() ?? trimmed;
}

export function parsePlanExtractResult(value: string): PlanExtractResult {
  const parsedJson = JSON.parse(stripJsonCodeFence(value));
  assertNoForbiddenPlanExtractKeys(parsedJson);
  const planExtractRoot = selectPlanExtractRoot(parsedJson);
  if (Array.isArray(planExtractRoot)) {
    throw new Error("AI plan extraction returned no usable content.");
  }
  const normalizedJson = normalizePlanExtractResultJson(planExtractRoot);
  if (isRecord(normalizedJson) && !hasUsablePlanExtractContent(normalizedJson)) {
    throw new Error("AI plan extraction returned no usable content.");
  }
  return planExtractResultSchema.parse(normalizedJson);
}

const planExtractRootKeys = new Set([
  "version",
  "summary",
  "confidence",
  "extractionStatus",
  "extracted",
  "fieldConfidence",
  "fieldEvidence",
  "document",
  "scale",
  "location",
  "lot",
  "building",
  "rooms",
  "walls",
  "openings",
  "floorFinishes",
  "wallFinishes",
  "painting",
  "ceiling",
  "roof",
  "foundation",
  "structure",
  "electrical",
  "plumbing",
  "fixtures",
  "exterior",
  "quantitySeeds",
  "questions",
  "extractionWarnings",
  "assumptions",
  "missingInformation",
  "warnings",
  "providerMeta",
]);

const optionalObjectPlanExtractSections = [
  "document",
  "scale",
  "location",
  "lot",
  "building",
  "walls",
  "openings",
  "floorFinishes",
  "wallFinishes",
  "painting",
  "ceiling",
  "roof",
  "foundation",
  "structure",
  "electrical",
  "plumbing",
  "fixtures",
  "exterior",
  "providerMeta",
] as const;

const optionalArrayPlanExtractSections = ["rooms", "quantitySeeds", "questions", "extractionWarnings", "assumptions", "missingInformation", "warnings"] as const;

const optionalObjectPlanExtractSectionSchemas = {
  document: planExtractDocumentSchema,
  scale: planExtractScaleSchema,
  location: planExtractLocationSchema,
  lot: planExtractLotSchema,
  building: planExtractBuildingSchema,
  walls: planExtractWallsSchema,
  openings: planExtractOpeningsSchema,
  floorFinishes: planExtractFloorFinishesSchema,
  wallFinishes: planExtractWallFinishesSchema,
  painting: planExtractPaintingSchema,
  ceiling: planExtractCeilingSchema,
  roof: planExtractRoofSchema,
  foundation: planExtractFoundationSchema,
  structure: planExtractStructureSchema,
  electrical: planExtractElectricalSchema,
  plumbing: planExtractPlumbingSchema,
  fixtures: planExtractFixturesSchema,
  exterior: planExtractExteriorSchema,
  providerMeta: planExtractProviderMetaSchema,
};

const optionalArrayPlanExtractSectionSchemas = {
  rooms: planExtractRoomSchema,
  quantitySeeds: planExtractQuantitySeedSchema,
  questions: planExtractQuestionSchema,
  extractionWarnings: planExtractWarningSchema,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function looksLikePlanExtractRoot(value: unknown) {
  if (!isRecord(value)) return false;
  return ["version", "summary", "extracted", "document", "scale", "location", "lot", "building", "rooms", "openings", "quantitySeeds", "questions"].some((key) => key in value);
}

function selectPlanExtractRoot(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  if (value.length === 1 && isRecord(value[0])) return value[0];
  return value.find(looksLikePlanExtractRoot) ?? value;
}

function stripNullishPlanExtractValues(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(stripNullishPlanExtractValues).filter((item) => item !== undefined);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, nestedValue]) => [key, stripNullishPlanExtractValues(nestedValue)] as const)
      .filter(([, nestedValue]) => nestedValue !== undefined)
  );
}

function isPlanExtractConfidence(value: unknown): value is PlanExtractConfidence {
  return value === "low" || value === "medium" || value === "high";
}

function isPlanExtractStatus(value: unknown) {
  return value === "complete" || value === "partial" || value === "insufficient";
}

function deriveFallbackSummary(value: Record<string, unknown>) {
  const extracted = isRecord(value.extracted) ? value.extracted : undefined;
  const notes = extracted?.notes;
  const firstNote = Array.isArray(notes) ? notes.find((note): note is string => typeof note === "string" && note.trim().length > 0) : undefined;
  return (firstNote ?? "Extração preliminar da planta. Revise os campos antes de aplicar.").slice(0, 800);
}

function normalizeFieldConfidence(value: unknown) {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter((entry): entry is [string, PlanExtractConfidence] => typeof entry[0] === "string" && isPlanExtractConfidence(entry[1]));
  return Object.fromEntries(entries);
}

function normalizeFieldEvidence(value: unknown) {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0);
  return Object.fromEntries(entries);
}

function readExtractedValue(section: unknown, key: string) {
  if (!isRecord(section)) return undefined;
  const value = section[key];
  if (!isRecord(value) || !("value" in value)) return undefined;
  return value.value;
}

function readExtractedConfidence(section: unknown, key: string): PlanExtractConfidence | undefined {
  if (!isRecord(section)) return undefined;
  const value = section[key];
  if (!isRecord(value) || !isPlanExtractConfidence(value.confidence)) return undefined;
  return value.confidence;
}

function readExtractedEvidence(section: unknown, key: string): string | undefined {
  if (!isRecord(section)) return undefined;
  const value = section[key];
  if (!isRecord(value) || typeof value.evidence !== "string" || !value.evidence.trim()) return undefined;
  return value.evidence.trim();
}

function ensureNormalizedExtractedSection(value: Record<string, unknown>): Record<string, unknown> {
  const extracted = isRecord(value.extracted) ? value.extracted : {};
  value.extracted = extracted;
  return extracted;
}

function ensureNormalizedFieldConfidence(value: Record<string, unknown>): Record<string, unknown> {
  const fieldConfidence = isRecord(value.fieldConfidence) ? value.fieldConfidence : {};
  value.fieldConfidence = fieldConfidence;
  return fieldConfidence;
}

function ensureNormalizedFieldEvidence(value: Record<string, unknown>): Record<string, unknown> {
  const fieldEvidence = isRecord(value.fieldEvidence) ? value.fieldEvidence : {};
  value.fieldEvidence = fieldEvidence;
  return fieldEvidence;
}

function backfillExtractedFieldFromAdvancedSection(
  normalized: Record<string, unknown>,
  field: string,
  section: unknown,
  sectionField: string,
  type: "string" | "number",
  options: { integer?: boolean } = {}
) {
  const extracted = ensureNormalizedExtractedSection(normalized);
  if (extracted[field] !== undefined) return;

  const value = readExtractedValue(section, sectionField);
  if (type === "string") {
    if (typeof value !== "string" || !value.trim()) return;
    extracted[field] = value.trim();
  } else {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    if (options.integer && !Number.isInteger(value)) return;
    extracted[field] = value;
  }

  const confidence = readExtractedConfidence(section, sectionField);
  if (confidence) {
    const fieldConfidence = ensureNormalizedFieldConfidence(normalized);
    if (fieldConfidence[field] === undefined) fieldConfidence[field] = confidence;
  }

  const evidence = readExtractedEvidence(section, sectionField);
  if (evidence) {
    const fieldEvidence = ensureNormalizedFieldEvidence(normalized);
    if (fieldEvidence[field] === undefined) fieldEvidence[field] = evidence;
  }
}

function backfillExtractedOpeningCount(normalized: Record<string, unknown>, field: "doorCount" | "windowCount", sectionField: "doorCount" | "windowCount", itemsField: "doors" | "windows") {
  const openings = normalized.openings;
  const extracted = ensureNormalizedExtractedSection(normalized);
  if (extracted[field] !== undefined) return;

  const explicitCount = readExtractedValue(openings, sectionField);
  if (typeof explicitCount === "number" && Number.isInteger(explicitCount)) {
    extracted[field] = explicitCount;
    const confidence = readExtractedConfidence(openings, sectionField);
    const fieldConfidence = ensureNormalizedFieldConfidence(normalized);
    if (confidence && fieldConfidence[field] === undefined) fieldConfidence[field] = confidence;
    const evidence = readExtractedEvidence(openings, sectionField);
    const fieldEvidence = ensureNormalizedFieldEvidence(normalized);
    if (evidence && fieldEvidence[field] === undefined) fieldEvidence[field] = evidence;
    return;
  }

  if (!isRecord(openings) || !Array.isArray(openings[itemsField]) || openings[itemsField].length === 0) return;
  extracted[field] = openings[itemsField].length;
  const fieldConfidence = ensureNormalizedFieldConfidence(normalized);
  if (fieldConfidence[field] === undefined) fieldConfidence[field] = "medium";
  const fieldEvidence = ensureNormalizedFieldEvidence(normalized);
  if (fieldEvidence[field] === undefined) fieldEvidence[field] = `Quantidade derivada dos itens visíveis em ${itemsField}.`;
}

function backfillLegacyExtractedFieldsFromAdvancedSections(normalized: Record<string, unknown>) {
  backfillExtractedFieldFromAdvancedSection(normalized, "projectName", normalized.document, "title", "string");
  backfillExtractedFieldFromAdvancedSection(normalized, "address", normalized.location, "address", "string");
  backfillExtractedFieldFromAdvancedSection(normalized, "city", normalized.location, "city", "string");
  backfillExtractedFieldFromAdvancedSection(normalized, "state", normalized.location, "state", "string");
  backfillExtractedFieldFromAdvancedSection(normalized, "country", normalized.location, "country", "string");

  backfillExtractedFieldFromAdvancedSection(normalized, "terrainWidthM", normalized.lot, "widthM", "number");
  backfillExtractedFieldFromAdvancedSection(normalized, "terrainDepthM", normalized.lot, "depthM", "number");
  backfillExtractedFieldFromAdvancedSection(normalized, "terrainWidthM", normalized.building, "lotWidthM", "number");
  backfillExtractedFieldFromAdvancedSection(normalized, "terrainDepthM", normalized.building, "lotDepthM", "number");
  backfillExtractedFieldFromAdvancedSection(normalized, "houseWidthM", normalized.building, "widthM", "number");
  backfillExtractedFieldFromAdvancedSection(normalized, "houseDepthM", normalized.building, "depthM", "number");
  backfillExtractedFieldFromAdvancedSection(normalized, "builtAreaM2", normalized.building, "builtAreaM2", "number");
  backfillExtractedFieldFromAdvancedSection(normalized, "floorHeightM", normalized.building, "floorHeightM", "number");
  backfillExtractedFieldFromAdvancedSection(normalized, "floors", normalized.building, "floors", "number", { integer: true });

  const constructionMethod = readExtractedValue(normalized.building, "constructionMethodSuggestion");
  if (
    typeof constructionMethod === "string" &&
    planExtractConstructionMethodSchema.safeParse(constructionMethod).success &&
    ensureNormalizedExtractedSection(normalized).constructionMethod === undefined
  ) {
    ensureNormalizedExtractedSection(normalized).constructionMethod = constructionMethod;
    const confidence = readExtractedConfidence(normalized.building, "constructionMethodSuggestion");
    const fieldConfidence = ensureNormalizedFieldConfidence(normalized);
    if (confidence && fieldConfidence.constructionMethod === undefined) fieldConfidence.constructionMethod = confidence;
    const evidence = readExtractedEvidence(normalized.building, "constructionMethodSuggestion");
    const fieldEvidence = ensureNormalizedFieldEvidence(normalized);
    if (evidence && fieldEvidence.constructionMethod === undefined) fieldEvidence.constructionMethod = evidence;
  }

  backfillExtractedOpeningCount(normalized, "doorCount", "doorCount", "doors");
  backfillExtractedOpeningCount(normalized, "windowCount", "windowCount", "windows");
}

function hasNonEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(hasNonEmptyValue);
  if (isRecord(value)) return Object.values(value).some(hasNonEmptyValue);
  return false;
}

function hasUsablePlanExtractContent(value: Record<string, unknown>) {
  const extracted = isRecord(value.extracted) ? value.extracted : {};
  const extractedContent = Object.entries(extracted).some(([key, nestedValue]) => key !== "notes" && hasNonEmptyValue(nestedValue));
  if (extractedContent) return true;

  return [
    value.document,
    value.scale,
    value.location,
    value.lot,
    value.building,
    value.rooms,
    value.walls,
    value.openings,
    value.floorFinishes,
    value.wallFinishes,
    value.painting,
    value.ceiling,
    value.roof,
    value.foundation,
    value.structure,
    value.electrical,
    value.plumbing,
    value.fixtures,
    value.exterior,
    value.quantitySeeds,
    value.questions,
    value.extractionWarnings,
    value.assumptions,
    value.missingInformation,
    value.warnings,
  ].some(hasNonEmptyValue);
}

function normalizePlanExtractResultJson(value: unknown) {
  const stripped = stripNullishPlanExtractValues(value);
  if (!isRecord(stripped)) return stripped;

  const normalized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(stripped)) {
    if (planExtractRootKeys.has(key)) normalized[key] = nestedValue;
  }

  if (normalized.version === undefined) normalized.version = "1.0";
  if (typeof normalized.summary !== "string" || !normalized.summary.trim()) normalized.summary = deriveFallbackSummary(normalized);
  if (!isPlanExtractConfidence(normalized.confidence)) normalized.confidence = "low";
  if (!isPlanExtractStatus(normalized.extractionStatus)) delete normalized.extractionStatus;

  normalized.extracted = isRecord(normalized.extracted) ? normalized.extracted : {};
  if (isRecord(normalized.extracted) && "notes" in normalized.extracted && !Array.isArray(normalized.extracted.notes)) {
    delete normalized.extracted.notes;
  }

  const fieldConfidence = normalizeFieldConfidence(normalized.fieldConfidence);
  if (fieldConfidence) normalized.fieldConfidence = fieldConfidence;
  else delete normalized.fieldConfidence;

  const fieldEvidence = normalizeFieldEvidence(normalized.fieldEvidence);
  if (fieldEvidence) normalized.fieldEvidence = fieldEvidence;
  else delete normalized.fieldEvidence;

  for (const key of optionalObjectPlanExtractSections) {
    if (normalized[key] !== undefined && !isRecord(normalized[key])) delete normalized[key];
  }

  for (const key of optionalArrayPlanExtractSections) {
    if (normalized[key] !== undefined && !Array.isArray(normalized[key])) delete normalized[key];
  }

  for (const [key, schema] of Object.entries(optionalObjectPlanExtractSectionSchemas)) {
    const section = normalized[key];
    if (section === undefined) continue;
    const parsed = schema.safeParse(section);
    if (parsed.success) normalized[key] = parsed.data;
    else delete normalized[key];
  }

  for (const [key, schema] of Object.entries(optionalArrayPlanExtractSectionSchemas)) {
    const section = normalized[key];
    if (!Array.isArray(section)) continue;
    const items = section.map((item) => schema.safeParse(item)).filter((item) => item.success).map((item) => item.data);
    if (items.length > 0) normalized[key] = items;
    else delete normalized[key];
  }

  for (const key of ["assumptions", "missingInformation", "warnings"] as const) {
    const section = normalized[key];
    if (!Array.isArray(section)) continue;
    const items = section.filter((item): item is string => typeof item === "string");
    normalized[key] = items;
  }

  backfillLegacyExtractedFieldsFromAdvancedSections(normalized);

  return normalized;
}

const forbiddenPlanExtractKeys = new Set([
  "approval",
  "approved",
  "bdi",
  "composition",
  "compositionid",
  "consumption",
  "electricaldesign",
  "foundationdesign",
  "hh",
  "humanhours",
  "isapproved",
  "laborhours",
  "loss",
  "plumbingdesign",
  "price",
  "prices",
  "sinapicomposition",
  "structuredesign",
  "totalprice",
  "unitprice",
  "unitpricebrl",
  "waste",
]);

function normalizeForbiddenKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function assertNoForbiddenPlanExtractKeys(value: unknown, path: string[] = []) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPlanExtractKeys(item, [...path, String(index)]));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalized = normalizeForbiddenKey(key);
    if (forbiddenPlanExtractKeys.has(normalized)) {
      throw new Error(`Forbidden AI plan extraction key "${[...path, key].join(".")}".`);
    }
    assertNoForbiddenPlanExtractKeys(nestedValue, [...path, key]);
  }
}
