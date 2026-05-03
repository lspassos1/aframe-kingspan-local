import { describe, expect, it } from "vitest";
import { feedbackSchema } from "@/lib/validation/feedback";

describe("feedbackSchema", () => {
  it("rejects short feedback messages", () => {
    const result = feedbackSchema.safeParse({
      category: "melhoria",
      message: "curto",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid category and message", () => {
    const result = feedbackSchema.safeParse({
      category: "3d",
      message: "Gostaria de melhorar a visualizacao 3D com mais detalhes tecnicos.",
      contact: "teste@example.com",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("3d");
      expect(result.data.company).toBe("");
    }
  });

  it("rejects honeypot company content", () => {
    const result = feedbackSchema.safeParse({
      category: "bug",
      message: "Mensagem valida com detalhes suficientes sobre o problema encontrado.",
      company: "spam bot",
    });

    expect(result.success).toBe(false);
  });
});
