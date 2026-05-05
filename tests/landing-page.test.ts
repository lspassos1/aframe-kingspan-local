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

    expect(html).toContain("Orçamento preliminar de obra a partir da planta baixa.");
    expect(html).toContain("Começar com planta");
    expect(html).toContain("Ver exemplo");
    expect(html).toContain("IA lê e sugere");
    expect(html).toContain("Sistema calcula");
    expect(html).toContain("Usuário aprova");
    expect(html).toContain("Planta");
    expect(html).toContain("Base");
    expect(html).toContain("Exportação");
    expect(html).not.toContain("Escolha o método construtivo");
    expect(html).not.toContain("Comece pelo sistema da obra");
  });

  it("keeps signed-in users on the direct plan upload path", () => {
    clerkState.isSignedIn = true;

    const html = renderToStaticMarkup(createElement(HomeAuthExperience));

    expect(html).toContain('href="/start?mode=ai"');
    expect(html).toContain("Abrir app");
    expect(html).toContain('data-testid="user-button"');
  });
});
