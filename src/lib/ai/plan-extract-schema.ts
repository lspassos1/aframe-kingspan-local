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
  providerMeta: z
    .object({
      provider: z.string(),
      model: z.string(),
      tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
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
  return planExtractResultSchema.parse(parsedJson);
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
