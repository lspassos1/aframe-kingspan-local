import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Mobile3DControls } from "@/components/3d/Mobile3DControls";

const summary = [
  { label: "Volume", value: "9 x 11 m", detail: "Área 99 m²" },
  { label: "Altura", value: "2,80 m", detail: "Pé-direito" },
  { label: "Lote", value: "12 x 24 m", detail: "Implantação" },
];

describe("Mobile3DControls", () => {
  it("hides the PNG action when the simplified mobile preview has no canvas", () => {
    const html = renderToStaticMarkup(
      createElement(Mobile3DControls, {
        advancedControls: createElement("div", null, "Avançado"),
        onScreenshot: () => undefined,
        onViewChange: () => undefined,
        showScreenshotAction: false,
        summary,
        view: "iso",
      })
    );

    expect(html).toContain("Reset");
    expect(html).not.toContain("PNG");
  });

  it("keeps the PNG action available when a canvas-backed viewer opts in", () => {
    const html = renderToStaticMarkup(
      createElement(Mobile3DControls, {
        advancedControls: createElement("div", null, "Avançado"),
        onScreenshot: () => undefined,
        onViewChange: () => undefined,
        showScreenshotAction: true,
        summary,
        view: "iso",
      })
    );

    expect(html).toContain("PNG");
  });
});
