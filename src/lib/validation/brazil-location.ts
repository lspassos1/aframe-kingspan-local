import { z } from "zod";
import { isBrazilCityInState, isBrazilState } from "@/lib/locations/brazil";

export const brazilStateSchema = z
  .string()
  .trim()
  .min(1, "Estado obrigatorio")
  .max(80)
  .refine((value) => isBrazilState(value), "Selecione um estado do Brasil");

export const brazilCitySchema = z.string().trim().min(1, "Cidade obrigatoria").max(80);

export function addBrazilCityIssue(values: { state: string; city: string }, context: z.RefinementCtx) {
  if (values.state && values.city && !isBrazilCityInState(values.state, values.city)) {
    context.addIssue({
      code: "custom",
      path: ["city"],
      message: "Selecione uma cidade do estado informado",
    });
  }
}
