import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clerkState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => clerkState,
  UserButton: () => createElement("span", { "data-testid": "user-button" }, "User"),
}));

import { HomeAuthExperience } from "@/components/landing/HomeAuthExperience";

describe("HomeAuthExperience", () => {
  beforeEach(() => {
    clerkState.isLoaded = true;
    clerkState.isSignedIn = false;
  });

  it("positions the homepage around plan upload and reviewed budget workflow", () => {
    const html = renderToStaticMarkup(createElement(HomeAuthExperience));

    expect(html).toContain("Envie sua planta. Confirme os dados. Gere um orçamento preliminar com fonte.");
    expect(html).toContain("Enviar planta");
    expect(html).toContain("Ver exemplo");
    expect(html).toContain("IA sugere");
    expect(html).toContain("Sistema calcula");
    expect(html).toContain("Usuário aprova");
    expect(html).toContain("Planta enviada");
    expect(html).toContain("Dados extraídos");
    expect(html).toContain("Perguntas pendentes");
    expect(html).toContain("Quantitativos");
    expect(html).toContain("Fonte de preço");
    expect(html).toContain("Exportação");
    expect(html).toContain("Análise pronta");
    expect(html).toContain("planta-baixa.pdf");
    expect(html).toContain("Cache por hash ativo. Nada aplicado automaticamente.");
    expect(html).toContain("SINAPI 87489");
    expect(html).not.toContain("OpenAI configurado");
    expect(html).not.toContain("Gemini");
    expect(html).not.toContain("OpenRouter");
    expect(html).not.toContain("Groq");
    expect(html).not.toContain("Cerebras");
    expect(html).not.toContain("SambaNova");
    expect(html).not.toContain("Escolha o método construtivo");
    expect(html).not.toContain("Comece pelo sistema da obra");
  });

  it("keeps signed-in users on the direct plan upload path", () => {
    clerkState.isSignedIn = true;

    const html = renderToStaticMarkup(createElement(HomeAuthExperience));

    expect(html).toContain('href="/start?mode=ai"');
    expect(html).toContain('href="/start?mode=example"');
    expect(html).toContain("Abrir app");
    expect(html).toContain('data-testid="user-button"');
  });
});
