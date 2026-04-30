"use client";

import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import type { BudgetSummary, MaterialLine, Project, QuotationRequest, Scenario } from "@/types/project";
import { calculateAFrameGeometry } from "@/lib/calculations/geometry";
import { generateAssemblyDrawings } from "@/lib/calculations/drawings";
import { formatCurrency, slugify } from "@/lib/format";

export function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
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

export function exportMaterialsCsv(projectName: string, materials: MaterialLine[]) {
  const rows = materials.map((line) => ({
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
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  downloadTextFile(`${slugify(projectName)}-materiais.csv`, csv, "text/csv;charset=utf-8");
}

export function exportMaterialsXlsx(projectName: string, materials: MaterialLine[]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(
    materials.map((line) => ({
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
    }))
  );
  XLSX.utils.book_append_sheet(workbook, worksheet, "Materiais");
  XLSX.writeFile(workbook, `${slugify(projectName)}-materiais.xlsx`);
}

export function exportRfqText(projectName: string, requests: QuotationRequest[]) {
  const content = requests.map((request) => `${request.title}\n\n${request.body}`).join("\n\n---\n\n");
  downloadTextFile(`${slugify(projectName)}-pedidos-cotacao.txt`, content);
}

export function exportReportPdf(project: Project, scenario: Scenario, materials: MaterialLine[], budget: BudgetSummary) {
  const geometry = calculateAFrameGeometry(scenario.terrain, scenario.aFrame);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatorio preliminar A-frame", 15, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(project.name, 15, 28);
  doc.text(`${scenario.location.city}, ${scenario.location.state} - ${scenario.location.country}`, 15, 34);
  doc.setTextColor(154, 52, 18);
  doc.text("Estimativa preliminar. Nao substitui projeto estrutural, arquitetonico, ART/RRT ou aprovacao municipal.", 15, 44, {
    maxWidth: 180,
  });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Geometria", 15, 58);
  doc.setFont("helvetica", "normal");
  const geometryLines = [
    `Lote: ${scenario.terrain.width} x ${scenario.terrain.depth} m`,
    `Casa: ${geometry.baseWidth} x ${geometry.effectiveHouseDepth} m`,
    `Cumeeira: ${geometry.ridgeHeight} m`,
    `Area total terreo: ${geometry.groundFloorTotalArea} m2`,
    `Area util terreo: ${geometry.groundUsefulArea} m2`,
    `Area total combinada: ${geometry.combinedTotalArea} m2`,
    `Area util combinada: ${geometry.combinedUsefulArea} m2`,
  ];
  geometryLines.forEach((line, index) => doc.text(line, 15, 68 + index * 6));
  doc.setFont("helvetica", "bold");
  doc.text("Orcamento", 15, 116);
  doc.setFont("helvetica", "normal");
  doc.text(`Pacote de paineis: ${formatCurrency(budget.panelPackageCostBRL)}`, 15, 126);
  doc.text(`Acessorios: ${formatCurrency(budget.accessoriesCostBRL)}`, 15, 132);
  doc.text(`Frete: ${formatCurrency(budget.freightBRL)}`, 15, 138);
  doc.text(`Estrutura metalica: ${formatCurrency(budget.steelStructureCostBRL)}`, 15, 144);
  doc.text(`Total estimado: ${formatCurrency(budget.totalEstimatedCostBRL)}`, 15, 154);

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
  const drawings = generateAssemblyDrawings(project, scenario);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  for (const [index, drawing] of drawings.entries()) {
    if (index > 0) doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(drawing.title, 12, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Desenho SVG preliminar gerado por geometria parametrica. Validar com arquiteto/engenheiro.", 12, 20);
    const png = await svgToPngDataUrl(drawing.svg);
    doc.addImage(png, "PNG", 10, 26, 190, 126);
  }
  doc.save(`${slugify(project.name)}-projeto-tecnico.pdf`);
}
