import { z } from "zod";

export const terrainSchema = z.object({
  width: z.coerce.number().min(3, "Informe uma largura valida"),
  depth: z.coerce.number().min(3, "Informe uma profundidade valida"),
  frontSide: z.enum(["width", "depth"]),
  frontSetback: z.coerce.number().min(0),
  rearSetback: z.coerce.number().min(0),
  leftSetback: z.coerce.number().min(0),
  rightSetback: z.coerce.number().min(0),
});

export const locationSchema = z.object({
  address: z.string().max(200),
  city: z.string().min(1, "Cidade obrigatoria"),
  state: z.string().min(1, "Estado obrigatorio"),
  country: z.string().min(1, "Pais obrigatorio"),
  postalCode: z.string().max(20),
  notes: z.string().max(1000),
});

export const aFrameSchema = z.object({
  panelLength: z.coerce.number().min(2).max(20),
  panelUsefulWidth: z.coerce.number().min(0.3).max(2),
  panelThickness: z.coerce.number().min(10).max(200),
  baseAngleDeg: z.coerce.number().min(35).max(75),
  houseDepth: z.coerce.number().min(2).max(80),
  automaticDepth: z.boolean(),
  targetGroundUsefulArea: z.coerce.number().min(10).max(1000),
  upperFloorMode: z.enum(["none", "full-floor", "mezzanine-percent"]),
  upperFloorLevelHeight: z.coerce.number().min(1.8).max(5),
  upperFloorAreaPercent: z.coerce.number().min(0).max(100),
  floorBuildUpThickness: z.coerce.number().min(0).max(1),
  minimumUsefulHeight: z.coerce.number().min(1).max(2.3),
  ridgeCapAllowance: z.coerce.number().min(0).max(1),
  facadeType: z.enum(["open-glass", "panel-closed", "mixed", "placeholder"]),
  frontOverhang: z.coerce.number().min(0).max(3),
  rearOverhang: z.coerce.number().min(0).max(3),
  lateralBaseFlashingOffset: z.coerce.number().min(0).max(1),
});

export const pricingSchema = z.object({
  source: z.string().max(200),
  supplier: z.string().max(200),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validDays: z.coerce.number().min(1).max(365),
  freightBRL: z.coerce.number().min(0),
  notes: z.string().max(1000),
});

export const scenarioSchema = z.object({
  name: z.string().min(1).max(120),
  location: locationSchema,
  terrain: terrainSchema,
  aFrame: aFrameSchema,
  panelProductId: z.string().min(1),
  externalColor: z.string().min(1),
  internalFinish: z.string().min(1),
  steelMode: z.enum(["optimized", "conservative"]),
  pricing: pricingSchema,
});

export type ScenarioFormValues = z.infer<typeof scenarioSchema>;
