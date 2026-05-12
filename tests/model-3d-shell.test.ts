import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SceneFirstViewerShell, ViewerControlSection } from "@/components/3d/SceneFirstViewerShell";

const summary = [
  { label: "Volume", value: "9 x 11 m", detail: "Area 99 m2" },
  { label: "Altura", value: "2,80 m", detail: "Pe-direito" },
  { label: "Lote", value: "12 x 24 m", detail: "Implantacao" },
  { label: "Camadas", value: "5", detail: "Visiveis" },
];

describe("SceneFirstViewerShell", () => {
  it("renders the 3D scene as the primary surface with floating product controls", () => {
    const html = renderToStaticMarkup(
      createElement(SceneFirstViewerShell, {
        controls: createElement(ViewerControlSection, { title: "Camadas" }, "Controles avancados"),
        methodLabel: "A-frame",
        mobileControls: createElement("div", null, "Resumo mobile"),
        onResetView: () => undefined,
        onScreenshot: () => undefined,
        onViewChange: () => undefined,
        scene: createElement("div", null, "Cena 3D"),
        statusLabel: "Cenario base",
        summary,
        title: "Visualizacao interativa",
        view: "iso",
      })
    );

    expect(html).toContain('data-slot="scene-first-3d-shell"');
    expect(html).toContain('<h1 class="sr-only">Visualizacao interativa</h1>');
    expect(html).toContain("Cena 3D");
    expect(html).toContain("A-frame");
    expect(html).toContain("Visualizacao interativa");
    expect(html).toContain("3D");
    expect(html).toContain("Topo");
    expect(html).toContain("Frente");
    expect(html).toContain("Corte");
    expect(html).toContain("Reset");
    expect(html).toContain("PNG");
    expect(html).toContain("Controles");
    expect(html).toContain("Volume");
    expect(html).toContain("Resumo mobile");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("keeps the hidden controls panel closed by default", () => {
    const html = renderToStaticMarkup(
      createElement(SceneFirstViewerShell, {
        controls: createElement(ViewerControlSection, { title: "Camadas" }, "Conteudo colapsado"),
        methodLabel: "Metodo",
        mobileControls: null,
        onResetView: () => undefined,
        onScreenshot: () => undefined,
        onViewChange: () => undefined,
        scene: createElement("div", null, "Canvas"),
        screenshotEnabled: false,
        summary,
        title: "Modelo",
        view: "top",
      })
    );

    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Conteudo colapsado");
    expect(html).not.toContain("PNG");
  });
});
