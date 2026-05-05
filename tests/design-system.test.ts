import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ActionCard,
  ConfidenceBadge,
  FileDropzone,
  PageHeader,
  StepProgress,
  StatusPill,
} from "@/components/shared/design-system";

describe("shared design system primitives", () => {
  it("renders page headers with concise status and actions", () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, {
        eyebrow: "Dados da obra",
        title: "Projeto, local e geometria",
        description: "Resumo guiado da etapa atual.",
        status: createElement(StatusPill, { tone: "success" }, "Revisado"),
        actions: createElement("button", { type: "button" }, "Salvar"),
      })
    );

    expect(html).toContain('data-slot="page-header"');
    expect(html).toContain("Dados da obra");
    expect(html).toContain("Projeto, local e geometria");
    expect(html).toContain("Revisado");
    expect(html).toContain("Salvar");
  });

  it("marks step progress without hiding pending steps", () => {
    const html = renderToStaticMarkup(
      createElement(StepProgress, {
        currentIndex: 1,
        steps: [
          { label: "Entrada" },
          { label: "Revisão" },
          { label: "Estudo" },
        ],
      })
    );

    expect(html).toContain('data-slot="step-progress"');
    expect(html).toContain('data-state="complete"');
    expect(html).toContain('data-state="current"');
    expect(html).toContain('data-state="pending"');
  });

  it("supports actionable cards and safe file dropzone states", () => {
    const actionHtml = renderToStaticMarkup(
      createElement(ActionCard, {
        title: "Enviar planta baixa",
        description: "Comece pelo documento.",
        primary: true,
        onClick: () => undefined,
      })
    );
    const dropzoneHtml = renderToStaticMarkup(
      createElement(FileDropzone, {
        title: "Importar JSON",
        description: "Selecione um arquivo de projeto salvo.",
        actionLabel: "Escolher arquivo",
        disabled: true,
      })
    );

    expect(actionHtml).toContain("<button");
    expect(actionHtml).toContain('data-primary="true"');
    expect(actionHtml).toContain("Enviar planta baixa");
    expect(dropzoneHtml).toContain('data-slot="file-dropzone"');
    expect(dropzoneHtml).toContain('aria-disabled="true"');
    expect(dropzoneHtml).toContain("Escolher arquivo");
  });

  it("normalizes confidence labels for review surfaces", () => {
    expect(renderToStaticMarkup(createElement(ConfidenceBadge, { level: "high" }))).toContain("Alta");
    expect(renderToStaticMarkup(createElement(ConfidenceBadge, { level: "medium" }))).toContain("Média");
    expect(renderToStaticMarkup(createElement(ConfidenceBadge, { level: "unverified" }))).toContain("Sem revisão");
  });
});
