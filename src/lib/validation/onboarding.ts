import { z } from "zod";
import type { ConstructionMethodId } from "@/lib/construction-methods/types";
import { addBrazilCityIssue, brazilCitySchema, brazilStateSchema } from "@/lib/validation/brazil-location";

const constructionMethodIds = ["aframe", "conventional-masonry", "eco-block", "monolithic-eps"] as const satisfies readonly ConstructionMethodId[];

const emptyToUndefined = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
};

const optionalPositiveNumber = (min: number, max: number, message: string) =>
  z.preprocess(emptyToUndefined, z.coerce.number().min(min, message).max(max, "Revise o valor informado").optional());
const optionalNonNegativeNumber = (max: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().min(0, "Informe um valor zero ou maior").max(max, "Revise o valor informado").optional());
const optionalCount = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int("Informe um numero inteiro").min(0, "Informe zero ou mais").max(500, "Revise a quantidade").optional()
);
const optionalFloorCount = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int("Informe um numero inteiro").min(1, "Informe pelo menos 1 pavimento").max(100, "Revise o numero de pavimentos").optional()
);
const optionalWastePercent = z.preprocess(
  emptyToUndefined,
  z.coerce.number().min(0, "Informe uma perda zero ou maior").max(100, "Perdas nao podem passar de 100%").optional()
);

function requireNumber(
  values: Record<string, unknown>,
  context: z.RefinementCtx,
  path: string,
  min: number,
  message: string
) {
  const value = values[path];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) {
    context.addIssue({
      code: "custom",
      path: [path],
      message,
    });
  }
}

export const startProjectSchema = z
  .object({
    projectName: z.string().trim().min(2, "Informe o nome do projeto").max(120),
    address: z.string().trim().max(200).optional().default(""),
    city: brazilCitySchema,
    state: brazilStateSchema,
    country: z.string().trim().min(1, "Pais obrigatorio").max(80),
    terrainWidth: z.coerce.number().min(3, "Largura minima de 3 m").max(200, "Revise a largura do lote"),
    terrainDepth: z.coerce.number().min(3, "Profundidade minima de 3 m").max(300, "Revise a profundidade do lote"),
    panelProductId: z.string().min(1, "Selecione um painel"),
    panelLength: z.coerce.number().min(2, "Comprimento minimo de 2 m").max(20, "Comprimento acima do limite deste app"),
    baseAngleDeg: z.coerce.number().min(35, "Use pelo menos 35 graus").max(75, "Use no maximo 75 graus"),
    houseDepth: z.coerce.number().min(2, "Profundidade minima de 2 m").max(80, "Revise a profundidade da casa"),
  })
  .superRefine(addBrazilCityIssue);

export const methodProjectSchema = z
  .object({
    constructionMethod: z.enum(constructionMethodIds),
    projectName: z.string().trim().min(2, "Informe o nome do projeto").max(120),
    city: brazilCitySchema,
    state: brazilStateSchema,
    widthM: optionalPositiveNumber(2, 200, "Informe uma largura de pelo menos 2 m"),
    depthM: optionalPositiveNumber(2, 300, "Informe uma profundidade de pelo menos 2 m"),
    floorHeightM: optionalPositiveNumber(2, 6, "Informe um pe-direito de pelo menos 2 m"),
    floors: optionalFloorCount,
    internalWallLengthM: optionalNonNegativeNumber(1000),
    blockType: z.enum(["ceramic", "concrete"]).optional(),
    blockLengthM: optionalPositiveNumber(0.1, 1, "Informe o comprimento do bloco"),
    blockHeightM: optionalPositiveNumber(0.05, 0.5, "Informe a altura do bloco"),
    blockWidthM: optionalPositiveNumber(0.08, 0.5, "Informe a largura do bloco"),
    blocksPerM2: optionalPositiveNumber(1, 200, "Informe os blocos por m2"),
    useType: z.enum(["infill", "structural-preliminary"]).optional(),
    finishType: z.enum(["exposed", "plastered"]).optional(),
    epsCoreThicknessM: optionalPositiveNumber(0.03, 0.5, "Informe a espessura do nucleo EPS"),
    renderThicknessPerFaceM: optionalPositiveNumber(0.01, 0.2, "Informe o revestimento por face"),
    finalWallThicknessM: optionalPositiveNumber(0.08, 1, "Informe a espessura final"),
    panelWidthM: optionalPositiveNumber(0.3, 3, "Informe a largura do painel"),
    panelHeightM: optionalPositiveNumber(1, 6, "Informe a altura do painel"),
    wallThicknessM: optionalPositiveNumber(0.09, 1, "Informe a espessura da parede"),
    doorCount: optionalCount,
    doorWidthM: optionalPositiveNumber(0.5, 5, "Informe a largura da porta"),
    doorHeightM: optionalPositiveNumber(1.8, 5, "Informe a altura da porta"),
    windowCount: optionalCount,
    windowWidthM: optionalPositiveNumber(0.4, 8, "Informe a largura da janela"),
    windowHeightM: optionalPositiveNumber(0.4, 4, "Informe a altura da janela"),
    foundationType: z.enum(["radier", "baldrame", "placeholder"]).optional(),
    roofType: z.enum(["simple-roof", "slab", "placeholder"]).optional(),
    internalPlaster: z.boolean().optional(),
    externalPlaster: z.boolean().optional(),
    subfloor: z.boolean().optional(),
    basicFinish: z.boolean().optional(),
    groutingEnabled: z.boolean().optional(),
    verticalRebarEnabled: z.boolean().optional(),
    horizontalRebarEnabled: z.boolean().optional(),
    baseWaterproofingEnabled: z.boolean().optional(),
    specializedLabor: z.boolean().optional(),
    starterBarsEnabled: z.boolean().optional(),
    openingReinforcementEnabled: z.boolean().optional(),
    projectionEquipmentRequired: z.boolean().optional(),
    specializedLaborRequired: z.boolean().optional(),
    finalFinish: z.boolean().optional(),
    wastePercent: optionalWastePercent,
  })
  .superRefine((values, context) => {
    if (values.constructionMethod === "aframe") return;

    addBrazilCityIssue(values, context);
    requireNumber(values, context, "widthM", 2, "Informe uma largura de pelo menos 2 m");
    requireNumber(values, context, "depthM", 2, "Informe uma profundidade de pelo menos 2 m");
    requireNumber(values, context, "floorHeightM", 2, "Informe um pe-direito de pelo menos 2 m");

    if (values.constructionMethod === "conventional-masonry") {
      requireNumber(values, context, "floors", 1, "Informe pelo menos 1 pavimento");
      requireNumber(values, context, "wallThicknessM", 0.09, "Informe a espessura da parede");
      requireNumber(values, context, "doorWidthM", 0.5, "Informe a largura da porta");
      requireNumber(values, context, "doorHeightM", 1.8, "Informe a altura da porta");
      requireNumber(values, context, "windowWidthM", 0.4, "Informe a largura da janela");
      requireNumber(values, context, "windowHeightM", 0.4, "Informe a altura da janela");
    }

    if (values.constructionMethod === "eco-block") {
      requireNumber(values, context, "blockLengthM", 0.1, "Informe o comprimento do bloco");
      requireNumber(values, context, "blockHeightM", 0.05, "Informe a altura do bloco");
      requireNumber(values, context, "blockWidthM", 0.08, "Informe a largura do bloco");
      requireNumber(values, context, "blocksPerM2", 1, "Informe os blocos por m2");
      requireNumber(values, context, "doorWidthM", 0.5, "Informe a largura da porta");
      requireNumber(values, context, "doorHeightM", 1.8, "Informe a altura da porta");
      requireNumber(values, context, "windowWidthM", 0.4, "Informe a largura da janela");
      requireNumber(values, context, "windowHeightM", 0.4, "Informe a altura da janela");
    }

    if (values.constructionMethod === "monolithic-eps") {
      requireNumber(values, context, "epsCoreThicknessM", 0.03, "Informe a espessura do nucleo EPS");
      requireNumber(values, context, "renderThicknessPerFaceM", 0.01, "Informe o revestimento por face");
      requireNumber(values, context, "finalWallThicknessM", 0.08, "Informe a espessura final");
      requireNumber(values, context, "panelWidthM", 0.3, "Informe a largura do painel");
      requireNumber(values, context, "panelHeightM", 1, "Informe a altura do painel");
      requireNumber(values, context, "doorWidthM", 0.5, "Informe a largura da porta");
      requireNumber(values, context, "doorHeightM", 1.8, "Informe a altura da porta");
      requireNumber(values, context, "windowWidthM", 0.4, "Informe a largura da janela");
      requireNumber(values, context, "windowHeightM", 0.4, "Informe a altura da janela");
    }
  });

export type StartProjectFormValues = z.infer<typeof startProjectSchema>;
export type MethodProjectFormValues = z.infer<typeof methodProjectSchema>;
