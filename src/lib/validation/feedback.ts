import { z } from "zod";

export const feedbackSchema = z.object({
  name: z.string().max(80).optional().default(""),
  contact: z.string().max(120).optional().default(""),
  category: z.enum(["bug", "melhoria", "orcamento", "3d", "privacidade", "outro"]),
  message: z.string().min(20, "Descreva a melhoria com pelo menos 20 caracteres.").max(3000),
  company: z.string().max(0).optional().default(""),
});

export type FeedbackFormValues = z.infer<typeof feedbackSchema>;
