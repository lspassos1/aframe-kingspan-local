import { z } from "zod";

export const startProjectSchema = z.object({
  projectName: z.string().trim().min(2, "Informe o nome do projeto").max(120),
  address: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(1, "Cidade obrigatoria").max(80),
  state: z.string().trim().min(1, "Estado obrigatorio").max(80),
  country: z.string().trim().min(1, "Pais obrigatorio").max(80),
  terrainWidth: z.coerce.number().min(3, "Largura minima de 3 m").max(200, "Revise a largura do lote"),
  terrainDepth: z.coerce.number().min(3, "Profundidade minima de 3 m").max(300, "Revise a profundidade do lote"),
  panelProductId: z.string().min(1, "Selecione um painel"),
  panelLength: z.coerce.number().min(2, "Comprimento minimo de 2 m").max(20, "Comprimento acima do limite deste app"),
  baseAngleDeg: z.coerce.number().min(35, "Use pelo menos 35 graus").max(75, "Use no maximo 75 graus"),
  houseDepth: z.coerce.number().min(2, "Profundidade minima de 2 m").max(80, "Revise a profundidade da casa"),
});

export type StartProjectFormValues = z.infer<typeof startProjectSchema>;
