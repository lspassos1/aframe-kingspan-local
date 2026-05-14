"use client";

import type { BudgetSummary, MaterialLine, Project, QuotationRequest, Scenario } from "@/types/project";
import { generateAssemblyDrawings } from "@/lib/calculations/drawings";
import { createBudgetSourceExport, createBudgetSourceWorkbookRows } from "@/lib/budget-assistant";
import { generateScenarioTechnicalSummary } from "@/lib/construction-methods/scenario-calculations";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import { formatCurrency, slugify } from "@/lib/format";
import { createXlsxBlobPartFromSheets, isSpreadsheetLibraryReady, prepareSpreadsheetLibrary, rowsToCsv, type SpreadsheetRow } from "@/lib/spreadsheet/tabular";

type JsPdfConstructor = typeof import("jspdf")["default"];

let jsPdfConstructor: JsPdfConstructor | null = null;
let jsPdfPromise: Promise<JsPdfConstructor> | null = null;

export function isSpreadsheetExportLibraryReady() {
  return isSpreadsheetLibraryReady();
}

export function isPdfExportLibraryReady() {
  return Boolean(jsPdfConstructor);
}

export async function prepareSpreadsheetExportLibrary() {
  await prepareSpreadsheetLibrary();
}

export async function preparePdfExportLibrary() {
  await loadJsPdf();
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  downloadBlob(filename, blob);
}

function downloadBinaryFile(filename: string, content: BlobPart) {
  downloadBlob(filename, new Blob([content], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportProjectJson(project: Project) {
  downloadTextFile(`${slugify(project.name) || "projeto-aframe"}.json`, JSON.stringify(project, null, 2), "application/json");
}

export async function exportMaterialsCsv(projectName: string, materials: MaterialLine[], methodName: string) {
  const rows = materials.map((line) => ({
    metodo: methodName,
    codigo: line.code,
    descricao: line.description,
    categoria: line.category,
    fornecedor: line.supplier,
    quantidade: line.quantity,
    unidade: line.unit,
    preco_unitario: line.unitPriceBRL ?? "",
    total_bruto: line.grossTotalBRL,
    desconto: line.discountBRL,
    total_liquido: line.netTotalBRL,
    confirmar: line.requiresConfirmation ? "sim" : "nao",
    observacoes: line.notes,
  }));
  downloadTextFile(`${slugify(projectName)}-materiais.csv`, rowsToCsv(rows), "text/csv;charset=utf-8");
}

export async function exportMaterialsXlsx(projectName: string, materials: MaterialLine[], methodName: string) {
  const rows = materials.map((line) => ({
      Metodo: methodName,
      Codigo: line.code,
      Descricao: line.description,
      Categoria: line.category,
      Fornecedor: line.supplier,
      Quantidade: line.quantity,
      Unidade: line.unit,
      "Preco unitario": line.unitPriceBRL ?? "",
      "Total bruto": line.grossTotalBRL,
      Desconto: line.discountBRL,
      "Total liquido": line.netTotalBRL,
      "Confirmar fornecedor": line.requiresConfirmation ? "sim" : "nao",
      Observacoes: line.notes,
    }));
  const blobPart = await createXlsxBlobPartFromSheets([{ name: "Materiais", rows }]);
  downloadBinaryFile(`${slugify(projectName)}-materiais.xlsx`, blobPart);
}

export function exportRfqText(projectName: string, requests: QuotationRequest[]) {
  const content = requests.map((request) => `${request.title}\n\n${request.body}`).join("\n\n---\n\n");
  downloadTextFile(`${slugify(projectName)}-pedidos-cotacao.txt`, content);
}

export function exportBudgetSourceJson(project: Project, scenario: Scenario) {
  const report = createBudgetSourceExport(project, scenario);
  downloadTextFile(`${slugify(project.name)}-orcamento-fontes.json`, JSON.stringify(report, null, 2), "application/json");
}

export async function exportBudgetSourceXlsx(project: Project, scenario: Scenario) {
  const report = createBudgetSourceExport(project, scenario);
  const rows = createBudgetSourceWorkbookRows(report);
  const blobPart = await createXlsxBlobPartFromSheets([
    { name: "Resumo", rows: rows.summary as SpreadsheetRow[] },
    { name: "Fontes", rows: rows.sources as SpreadsheetRow[] },
    { name: "Composicoes", rows: rows.compositions as SpreadsheetRow[] },
    { name: "Servicos", rows: rows.serviceLines as SpreadsheetRow[] },
    { name: "HH", rows: rows.laborHours as SpreadsheetRow[] },
    { name: "Pendencias", rows: rows.pendingItems as SpreadsheetRow[] },
  ]);
  downloadBinaryFile(`${slugify(project.name)}-orcamento-fontes.xlsx`, blobPart);
}

export async function exportBudgetSourcePdf(project: Project, scenario: Scenario) {
  const jsPDF = jsPdfConstructor ?? (await loadJsPdf());
  const report = createBudgetSourceExport(project, scenario);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Orcamento por fontes - ${report.constructionMethod.name}`, 12, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${report.projectName} | ${report.scenarioName} | ${report.location.city}/${report.location.state}`, 12, 22);
  doc.text(`Status: ${report.budgetStatusLabel}. Orcamento final: nao.`, 12, 28);
  doc.setTextColor(154, 52, 18);
  doc.text(report.technicalNotice, 12, 36, { maxWidth: 185 });
  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "bold");
  doc.text("Resumo financeiro", 12, 52);
  doc.setFont("helvetica", "normal");
  [
    `Material: ${formatCurrency(report.totals.materialCostBRL)}`,
    `Mao de obra: ${formatCurrency(report.totals.laborCostBRL)} | H/H: ${report.totals.totalLaborHours}`,
    `Equipamento: ${formatCurrency(report.totals.equipmentCostBRL)}`,
    `BDI: ${formatCurrency(report.totals.bdiBRL)} | Contingencia: ${formatCurrency(report.totals.contingencyBRL)}`,
    `Total revisavel/preliminar: ${formatCurrency(report.totals.totalBRL)}`,
    `Itens sem preco: ${report.totals.unpricedCount} | Linhas revisaveis: ${report.totals.reviewableLineCount}`,
  ].forEach((line, index) => doc.text(line, 12, 62 + index * 6));

  doc.setFont("helvetica", "bold");
  doc.text("Fontes", 12, 104);
  doc.setFont("helvetica", "normal");
  report.sources.slice(0, 8).forEach((source, index) => {
    doc.text(`${source.title} | ${source.city}/${source.state} | ${source.referenceDate} | ${source.reliability}`, 12, 114 + index * 6, {
      maxWidth: 185,
    });
  });

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.text("Servicos e composicoes", 12, 14);
  doc.setFont("helvetica", "normal");
  const rows = report.serviceLines.length > 0 ? report.serviceLines : report.serviceCompositions;
  rows.slice(0, 26).forEach((line, index) => {
    const total = "totalBRL" in line ? line.totalBRL : line.directUnitCostBRL;
    const quantity = "quantity" in line ? ` | Qtd ${line.quantity} ${line.unit}` : ` | Un. ${line.unit}`;
    const laborHours = "totalLaborHours" in line ? line.totalLaborHours : line.totalLaborHoursPerUnit;
    doc.text(
      `${line.sinapiCode || line.sourceCode} | ${line.description}${quantity} | ${line.state} ${line.referenceDate} ${line.regime} | ${line.priceStatus} | ${line.sourceTitle} | H/H ${laborHours} | ${line.reviewStatus} | ${formatCurrency(total)}`,
      12,
      24 + index * 7,
      { maxWidth: 185 }
    );
  });

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.text("Pendencias", 12, 14);
  doc.setFont("helvetica", "normal");
  report.warnings.slice(0, 12).forEach((warning, index) => doc.text(`- ${warning}`, 12, 24 + index * 7, { maxWidth: 185 }));
  doc.save(`${slugify(project.name)}-orcamento-fontes.pdf`);
}

export async function exportReportPdf(project: Project, scenario: Scenario, materials: MaterialLine[], budget: BudgetSummary) {
  const jsPDF = jsPdfConstructor ?? (await loadJsPdf());
  const summary = generateScenarioTechnicalSummary(project, scenario);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`Relatorio preliminar - ${summary.methodName}`, 15, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(project.name, 15, 28);
  doc.text(`${scenario.location.city}, ${scenario.location.state} - ${scenario.location.country}`, 15, 34);
  doc.text(`Metodo construtivo: ${summary.methodName}`, 15, 40);
  doc.text("Status: preliminar", 15, 46);
  doc.setTextColor(154, 52, 18);
  doc.text("Estimativa preliminar. Nao substitui projeto estrutural, arquitetonico, ART/RRT, sondagem, fornecedor ou aprovacao municipal.", 15, 56, {
    maxWidth: 180,
  });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo tecnico", 15, 72);
  doc.setFont("helvetica", "normal");
  const geometryLines = [`Lote: ${scenario.terrain.width} x ${scenario.terrain.depth} m`, ...summary.metrics.map((metric) => `${metric.label}: ${metric.value}`)];
  geometryLines.forEach((line, index) => doc.text(line, 15, 82 + index * 6));
  doc.setFont("helvetica", "bold");
  doc.text("Orcamento", 15, 130);
  doc.setFont("helvetica", "normal");
  doc.text(`Total preliminar: ${formatCurrency(budget.totalEstimatedCostBRL)}`, 15, 140);
  doc.text(`Custo/m2: ${formatCurrency(budget.costPerTotalM2)}`, 15, 146);
  doc.text(`Itens sem fonte/preco revisado: ${budget.items.filter((item) => item.requiresConfirmation).length}`, 15, 152);
  doc.setFont("helvetica", "bold");
  doc.text("Alertas", 15, 164);
  doc.setFont("helvetica", "normal");
  summary.warnings.slice(0, 6).forEach((warning, index) => {
    doc.text(`- ${warning}`, 15, 174 + index * 6, { maxWidth: 180 });
  });

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.text("Lista de materiais", 15, 18);
  doc.setFont("helvetica", "normal");
  materials.slice(0, 28).forEach((line, index) => {
    doc.text(`${line.quantity} ${line.unit} - ${line.code}`, 15, 30 + index * 8, { maxWidth: 180 });
  });
  doc.save(`${slugify(project.name)}-relatorio.pdf`);
}

function svgToPngDataUrl(svg: string, width = 720, height = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas indisponivel para exportar SVG."));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel renderizar o SVG para PDF."));
    };
    image.src = url;
  });
}

export async function exportTechnicalPdf(project: Project, scenario: Scenario) {
  const jsPDF = jsPdfConstructor ?? (await loadJsPdf());

  if (scenario.constructionMethod !== "aframe") {
    const summary = generateScenarioTechnicalSummary(project, scenario);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Projeto tecnico preliminar - ${summary.methodName}`, 12, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Resumo preliminar por metodo construtivo. Validar com arquiteto, engenheiro, fornecedor e ART/RRT.", 12, 22, { maxWidth: 185 });
    summary.metrics.forEach((metric, index) => doc.text(`${metric.label}: ${metric.value}`, 12, 36 + index * 6));
    doc.setFont("helvetica", "bold");
    doc.text("Alertas", 12, 86);
    doc.setFont("helvetica", "normal");
    summary.warnings.slice(0, 10).forEach((warning, index) => doc.text(`- ${warning}`, 12, 96 + index * 7, { maxWidth: 185 }));
    doc.save(`${slugify(project.name)}-projeto-tecnico.pdf`);
    return;
  }

  const methodDefinition = getConstructionMethodDefinition(scenario.constructionMethod);
  const drawings = generateAssemblyDrawings(project, scenario);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  for (const [index, drawing] of drawings.entries()) {
    if (index > 0) doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${drawing.title} - ${methodDefinition.name}`, 12, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Desenho SVG preliminar gerado por geometria parametrica. Validar com arquiteto/engenheiro.", 12, 20);
    const png = await svgToPngDataUrl(drawing.svg);
    doc.addImage(png, "PNG", 10, 26, 190, 126);
  }
  doc.save(`${slugify(project.name)}-projeto-tecnico.pdf`);
}

async function loadJsPdf(): Promise<JsPdfConstructor> {
  if (jsPdfConstructor) return jsPdfConstructor;
  jsPdfPromise ??= import("jspdf")
    .then((module) => {
      jsPdfConstructor = module.default;
      return module.default;
    })
    .catch((error) => {
      jsPdfPromise = null;
      throw error;
    });
  return jsPdfPromise;
}
