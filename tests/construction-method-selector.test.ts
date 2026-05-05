import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConstructionMethodSelector } from "@/components/onboarding/ConstructionMethodSelector";
import { constructionMethodDefinitions } from "@/lib/construction-methods";
import { getMethodSelectorCardCopy } from "@/lib/onboarding/construction-method-selector";

describe("ConstructionMethodSelector", () => {
  it("uses compact visible copy with one sentence and exactly two chips per method", () => {
    for (const definition of constructionMethodDefinitions) {
      const copy = getMethodSelectorCardCopy(definition);

      expect(copy.visibleDescription.endsWith(".")).toBe(true);
      expect(copy.visibleDescription.match(/\./g) ?? []).toHaveLength(1);
      expect(copy.visibleDescription.length).toBeLessThanOrEqual(56);
      expect(copy.chips).toHaveLength(2);
    }
  });

  it("renders active state accessibly and keeps technical details behind a disclosure", () => {
    const html = renderToStaticMarkup(createElement(ConstructionMethodSelector, { selectedMethod: "eco-block", onSelect: vi.fn() }));

    expect(html).toContain("Solo-cimento");
    expect(html).toContain("Bloco modular com menos revestimento.");
    expect(html).toContain("Modular");
    expect(html).toContain("Econômico");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Detalhes técnicos");
    expect(html).toContain("<details");
  });

  it("removes the old metric badges and first-layer technical alert labels", () => {
    const html = renderToStaticMarkup(createElement(ConstructionMethodSelector, { selectedMethod: "aframe", onSelect: vi.fn() }));

    expect(html).not.toContain("Vel.");
    expect(html).not.toContain("Comp.");
    expect(html).not.toContain("Ind.");
    expect(html).not.toContain("Alertas e limites");
    expect(html).not.toContain("MVP");
  });
});
