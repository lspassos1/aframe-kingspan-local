"use client";

import { ChangeEvent, useRef } from "react";
import { Download, FileJson, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateBudget } from "@/lib/calculations/budget";
import { calculateMaterialList } from "@/lib/calculations/materials";
import { generateQuotationRequests } from "@/lib/calculations/quotation";
import {
  exportMaterialsCsv,
  exportMaterialsXlsx,
  exportProjectJson,
  exportReportPdf,
  exportRfqText,
  exportTechnicalPdf,
} from "@/lib/export/files";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import type { Project } from "@/types/project";

export default function ExportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const project = useProjectStore((state) => state.project);
  const importProject = useProjectStore((state) => state.importProject);
  const resetProject = useProjectStore((state) => state.resetProject);
  const scenario = useSelectedScenario();
  const materials = calculateMaterialList(project, scenario);
  const budget = calculateBudget(project, scenario);
  const requests = generateQuotationRequests(project, scenario);

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as Project;
    importProject(parsed);
    event.target.value = "";
  };

  const actions = [
    {
      title: "Projeto JSON",
      description: "Arquivo completo para salvar, versionar ou importar novamente no navegador.",
      icon: FileJson,
      action: () => exportProjectJson(project),
      label: "Baixar JSON",
    },
    {
      title: "Lista XLSX",
      description: "Planilha editavel da lista de materiais e acessorios.",
      icon: FileSpreadsheet,
      action: () => exportMaterialsXlsx(project.name, materials),
      label: "Baixar XLSX",
    },
    {
      title: "Lista CSV",
      description: "CSV simples para importar em planilhas ou ERPs.",
      icon: FileSpreadsheet,
      action: () => exportMaterialsCsv(project.name, materials),
      label: "Baixar CSV",
    },
    {
      title: "Relatorio PDF",
      description: "Resumo com geometria, areas, materiais, orcamento e avisos.",
      icon: FileText,
      action: () => exportReportPdf(project, scenario, materials, budget),
      label: "Baixar PDF",
    },
    {
      title: "Projeto tecnico PDF",
      description: "PDF com desenhos SVG preliminares gerados pela geometria.",
      icon: FileText,
      action: () => void exportTechnicalPdf(project, scenario),
      label: "Baixar PDF tecnico",
    },
    {
      title: "Pedidos de cotacao",
      description: "Texto para paineis, aco, fabricacao metalica e orcamento geral.",
      icon: FileText,
      action: () => exportRfqText(project.name, requests),
      label: "Baixar TXT",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Exportar</p>
        <h1 className="text-3xl font-semibold tracking-normal">Salvar, carregar e gerar arquivos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tudo funciona localmente no navegador. Nao ha nuvem, login ou backend.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-md shadow-none">
          <CardHeader>
            <CardTitle>Importar projeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
            <Button className="w-full" variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Importar JSON
            </Button>
            <Button className="w-full" variant="destructive" onClick={resetProject}>
              Resetar para default
            </Button>
          </CardContent>
        </Card>
        {actions.map((item) => {
          const Icon = item.icon;
          return (
            <Card className="rounded-md shadow-none" key={item.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="min-h-12 text-sm text-muted-foreground">{item.description}</p>
                <Button className="w-full" onClick={item.action}>
                  <Download className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
