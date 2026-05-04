import { z } from "zod";
import type { ConstructionMethodId } from "@/lib/construction-methods/types";
import { isBrazilCityInState, isBrazilState } from "@/lib/locations/brazil";

const constructionMethodIds = ["aframe", "conventional-masonry", "eco-block", "monolithic-eps"] as const satisfies readonly ConstructionMethodId[];

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}, z.coerce.number().optional());

const brazilStateSchema = z
  .string()
  .trim()
  .min(1, "Estado obrigatorio")
  .max(80)
  .refine((value) => isBrazilState(value), "Selecione um estado do Brasil");

const brazilCitySchema = z.string().trim().min(1, "Cidade obrigatoria").max(80);

function addBrazilCityIssue(values: { state: string; city: string }, context: z.RefinementCtx) {
  if (values.state && values.city && !isBrazilCityInState(values.state, values.city)) {
    context.addIssue({
      code: "custom",
      path: ["city"],
      message: "Selecione uma cidade do estado informado",
    });
  }
}

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
    widthM: optionalNumber,
    depthM: optionalNumber,
    floorHeightM: optionalNumber,
    floors: optionalNumber,
    internalWallLengthM: optionalNumber,
    blockType: z.enum(["ceramic", "concrete"]).optional(),
    blockLengthM: optionalNumber,
    blockHeightM: optionalNumber,
    blockWidthM: optionalNumber,
    blocksPerM2: optionalNumber,
    useType: z.enum(["infill", "structural-preliminary"]).optional(),
    finishType: z.enum(["exposed", "plastered"]).optional(),
    epsCoreThicknessM: optionalNumber,
    renderThicknessPerFaceM: optionalNumber,
    finalWallThicknessM: optionalNumber,
    panelWidthM: optionalNumber,
    panelHeightM: optionalNumber,
    wallThicknessM: optionalNumber,
    doorCount: optionalNumber,
    doorWidthM: optionalNumber,
    doorHeightM: optionalNumber,
    windowCount: optionalNumber,
    windowWidthM: optionalNumber,
    windowHeightM: optionalNumber,
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
    wastePercent: optionalNumber,
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
