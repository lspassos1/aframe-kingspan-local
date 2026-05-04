import { z } from "zod";

export const planExtractConfidenceSchema = z.enum(["low", "medium", "high"]);

export const planExtractConstructionMethodSchema = z.enum(["aframe", "conventional-masonry", "eco-block", "monolithic-eps"]);

export const planExtractResultSchema = z.object({
  version: z.literal("1.0"),
  summary: z.string().max(800),
  confidence: planExtractConfidenceSchema,
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
});

export type PlanExtractConfidence = z.infer<typeof planExtractConfidenceSchema>;
export type PlanExtractResult = z.infer<typeof planExtractResultSchema>;

export function stripJsonCodeFence(value: string) {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch?.[1]?.trim() ?? trimmed;
}

export function parsePlanExtractResult(value: string): PlanExtractResult {
  return planExtractResultSchema.parse(JSON.parse(stripJsonCodeFence(value)));
}
