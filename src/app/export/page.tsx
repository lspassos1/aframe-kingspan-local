"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Download, FileJson, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateScenarioBudget,
  calculateScenarioMaterials,
  generateScenarioQuotationRequests,
} from "@/lib/construction-methods/scenario-calculations";
import { getConstructionMethodDefinition } from "@/lib/construction-methods";
import {
  exportBudgetSourceJson,
  exportBudgetSourcePdf,
  exportBudgetSourceXlsx,
  exportMaterialsCsv,
  exportMaterialsXlsx,
  exportProjectJson,
  exportReportPdf,
  exportRfqText,
  exportTechnicalPdf,
  isPdfExportLibraryReady,
  isSpreadsheetExportLibraryReady,
  preparePdfExportLibrary,
  prepareSpreadsheetExportLibrary,
} from "@/lib/export/files";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import type { Project } from "@/types/project";

type ExportLibraryKind = "spreadsheet" | "pdf";
type ExportLibraryStatus = "loading" | "ready" | "failed";

export default function ExportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const isExportingRef = useRef(false);
  const [exportError, setExportError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportLibraryStatus, setExportLibraryStatus] = useState<Record<ExportLibraryKind, ExportLibraryStatus>>({
    spreadsheet: isSpreadsheetExportLibraryReady() ? "ready" : "loading",
    pdf: isPdfExportLibraryReady() ? "ready" : "loading",
  });
  const project = useProjectStore((state) => state.project);
  const importProject = useProjectStore((state) => state.importProject);
  const resetProject = useProjectStore((state) => state.resetProject);
  const scenario = useSelectedScenario();
  const methodDefinition = getConstructionMethodDefinition(scenario.constructionMethod);
  const materials = calculateScenarioMaterials(project, scenario);
  const budget = calculateScenarioBudget(project, scenario);
  const requests = generateScenarioQuotationRequests(project, scenario);

  useEffect(() => {
    let cancelled = false;

    prepareSpreadsheetExportLibrary()
      .then(() => {
        if (!cancelled) setExportLibraryStatus((current) => ({ ...current, spreadsheet: "ready" }));
      })
      .catch((error) => {
        console.error("Falha ao preparar exportadores de planilha:", error);
        if (!cancelled) {
          setExportLibraryStatus((current) => ({ ...current, spreadsheet: "failed" }));
          setExportError("Nao foi possivel preparar exportadores de planilha. Recarregue a pagina e tente novamente.");
        }
      });

    preparePdfExportLibrary()
      .then(() => {
        if (!cancelled) setExportLibraryStatus((current) => ({ ...current, pdf: "ready" }));
      })
      .catch((error) => {
        console.error("Falha ao preparar exportadores PDF:", error);
        if (!cancelled) {
          setExportLibraryStatus((current) => ({ ...current, pdf: "failed" }));
          setExportError("Nao foi possivel preparar exportadores PDF. Recarregue a pagina e tente novamente.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as Project;
    importProject(parsed);
    event.target.value = "";
  };

  const handleExportAction = async (action: () => void | Promise<void>) => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;
    setIsExporting(true);
    setExportError("");
    try {
      await action();
    } catch (error) {
      console.error("Falha ao exportar arquivo:", error);
      setExportError("Nao foi possivel gerar o arquivo. Tente novamente.");
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  };

  const prepareRequiredLibrary = async (kind?: ExportLibraryKind) => {
    if (!kind || exportLibraryStatus[kind] === "ready") return;
    setExportLibraryStatus((current) => ({ ...current, [kind]: "loading" }));
    try {
      if (kind === "spreadsheet") {
        await prepareSpreadsheetExportLibrary();
      } else {
        await preparePdfExportLibrary();
      }
      setExportLibraryStatus((current) => ({ ...current, [kind]: "ready" }));
    } catch (error) {
      setExportLibraryStatus((current) => ({ ...current, [kind]: "failed" }));
      throw error;
    }
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
      action: () => exportMaterialsXlsx(project.name, materials, methodDefinition.name),
      requiredLibrary: "spreadsheet" as const,
      label: "Baixar XLSX",
    },
    {
      title: "Lista CSV",
      description: "CSV simples para importar em planilhas ou ERPs.",
      icon: FileSpreadsheet,
      action: () => exportMaterialsCsv(project.name, materials, methodDefinition.name),
      requiredLibrary: "spreadsheet" as const,
      label: "Baixar CSV",
    },
    {
      title: "Relatorio PDF",
      description: "Resumo com metodo construtivo, status preliminar, materiais, orcamento e avisos.",
      icon: FileText,
      action: () => exportReportPdf(project, scenario, materials, budget),
      requiredLibrary: "pdf" as const,
      label: "Baixar PDF",
    },
    {
      title: "Orcamento por fontes XLSX",
      description: "Planilha com fontes, data-base, cidade/UF, confianca, HH, BDI, contingencia e pendencias.",
      icon: FileSpreadsheet,
      action: () => exportBudgetSourceXlsx(project, scenario),
      requiredLibrary: "spreadsheet" as const,
      label: "Baixar XLSX",
    },
    {
      title: "Orcamento por fontes JSON",
      description: "JSON method-aware para auditoria de fontes, itens sem preco e composicoes revisaveis.",
      icon: FileJson,
      action: () => exportBudgetSourceJson(project, scenario),
      label: "Baixar JSON",
    },
    {
      title: "Orcamento por fontes PDF",
      description: "Relatorio preliminar com separacao de custos, fontes e avisos de revisao humana.",
      icon: FileText,
      action: () => exportBudgetSourcePdf(project, scenario),
      requiredLibrary: "pdf" as const,
      label: "Baixar PDF",
    },
    {
      title: "Projeto tecnico PDF",
      description: "PDF tecnico preliminar; A-frame inclui desenhos, demais metodos incluem resumo tecnico.",
      icon: FileText,
      action: () => exportTechnicalPdf(project, scenario),
      requiredLibrary: "pdf" as const,
      label: "Baixar PDF tecnico",
    },
    {
      title: "Pedidos de cotacao",
      description: "Texto de cotacao gerado pelo metodo construtivo selecionado.",
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
          Os arquivos do projeto ficam no navegador. Login e autenticacao ficam no Clerk; este app nao armazena senhas.
        </p>
        {exportError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {exportError}
          </p>
        ) : null}
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
          const libraryStatus = item.requiredLibrary ? exportLibraryStatus[item.requiredLibrary] : "ready";
          const disabled = isExporting || libraryStatus === "loading";
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
                <Button
                  className="w-full"
                  onClick={() =>
                    void handleExportAction(async () => {
                      await prepareRequiredLibrary(item.requiredLibrary);
                      await item.action();
                    })
                  }
                  disabled={disabled}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {libraryStatus === "loading" ? "Preparando..." : libraryStatus === "failed" ? "Tentar novamente" : item.label}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
