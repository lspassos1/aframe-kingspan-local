"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, FileJson, FileSpreadsheet, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionCard, AdvancedDisclosure, FileDropzone, FormSection, InlineHelp, MetricCard, PageFrame, PageHeader, SectionHeader, StatusPill } from "@/components/shared/design-system";
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
  const pendingMaterials = materials.filter((item) => item.requiresConfirmation);
  const pendingBudgetItems = budget.items.filter((item) => item.requiresConfirmation);
  const exportWarnings = budget.warnings.filter((warning) => warning.level !== "info");
  const spreadsheetReady = exportLibraryStatus.spreadsheet === "ready";
  const pdfReady = exportLibraryStatus.pdf === "ready";

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
          setExportError("Nao foi possivel preparar exportadores de planilha. Clique em Tentar novamente.");
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
          setExportError("Nao foi possivel preparar exportadores PDF. Clique em Tentar novamente.");
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

  const prepareRequiredLibrary = async (kind: ExportLibraryKind) => {
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

  const runExportAction = (
    action: () => void | Promise<void>,
    requiredLibrary: ExportLibraryKind | undefined,
    libraryStatus: ExportLibraryStatus
  ) => {
    if (!requiredLibrary || libraryStatus === "ready") {
      void handleExportAction(action);
      return;
    }
    void handleExportAction(async () => {
      await prepareRequiredLibrary(requiredLibrary);
      await action();
    });
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
    <PageFrame>
      <PageHeader
        eyebrow="Exportar"
        title="Arquivos para revisão"
        description="Baixe projeto, planilhas e PDFs preliminares com materiais, fontes, pendências e status de revisão."
        status={<StatusPill tone="warning">Preliminar</StatusPill>}
      />
        {exportError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {exportError}
          </p>
        ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Materiais" value={materials.length} detail={`${pendingMaterials.length} pendente(s)`} tone={pendingMaterials.length > 0 ? "warning" : "success"} />
        <MetricCard label="Orçamento" value={formatExportCurrency(budget.totalEstimatedCostBRL)} detail={`${pendingBudgetItems.length} item(ns) sem fonte`} tone={pendingBudgetItems.length > 0 ? "warning" : "success"} />
        <MetricCard label="Planilhas" value={spreadsheetReady ? "Prontas" : "Preparando"} detail="XLSX/CSV sob demanda" tone={spreadsheetReady ? "success" : "pending"} />
        <MetricCard label="PDFs" value={pdfReady ? "Prontos" : "Preparando"} detail="Relatórios preliminares" tone={pdfReady ? "success" : "pending"} icon={<ShieldCheck className="h-4 w-4" />} />
      </section>

      {(pendingMaterials.length > 0 || pendingBudgetItems.length > 0 || exportWarnings.length > 0) ? (
        <InlineHelp tone="warning">
          O pacote pode ser exportado, mas deve sair como preliminar: há pendências de fonte, fornecedor ou alerta técnico que precisam aparecer no relatório.
        </InlineHelp>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <FormSection title="Importar projeto" description="Carregue um JSON exportado anteriormente.">
            <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
            <FileDropzone
              title="Importar JSON"
              description="Selecione um arquivo de projeto salvo."
              actionLabel="Escolher arquivo"
              onClick={() => inputRef.current?.click()}
            />
            <Button className="mt-3 w-full" variant="destructive" onClick={resetProject}>
              Resetar para default
            </Button>
        </FormSection>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Pacote de saída"
          title="Escolha o arquivo pelo uso"
          description="Cada ação informa o que será exportado e quais bibliotecas precisam estar prontas."
        />
        <div className="grid gap-4 md:grid-cols-3">
        {actions.map((item) => {
          const Icon = item.icon;
          const libraryStatus = item.requiredLibrary ? exportLibraryStatus[item.requiredLibrary] : "ready";
          const disabled = isExporting || libraryStatus === "loading";
          return (
            <ActionCard
              key={item.title}
              icon={Icon}
              title={item.title}
              description={item.description}
              footer={
                <Button
                  className="w-full"
                  onClick={() => runExportAction(item.action, item.requiredLibrary, libraryStatus)}
                  disabled={disabled}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {libraryStatus === "loading" ? "Preparando..." : libraryStatus === "failed" ? "Tentar novamente" : item.label}
                </Button>
              }
            />
          );
        })}
        </div>
      </section>

      <AdvancedDisclosure
        title="Bloqueios e avisos antes da exportação"
        description="Leitura rápida do que deve acompanhar o relatório preliminar."
        icon={AlertTriangle}
        badge={<StatusPill tone={pendingBudgetItems.length > 0 || exportWarnings.length > 0 ? "warning" : "success"}>{pendingBudgetItems.length + exportWarnings.length}</StatusPill>}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {pendingBudgetItems.slice(0, 6).map((item) => (
            <div key={item.id} className="rounded-2xl border bg-background/75 p-3 text-sm">
              <p className="font-medium">{item.description}</p>
              <p className="mt-1 text-muted-foreground">Sem fonte revisada: {item.supplier || "a confirmar"}</p>
            </div>
          ))}
          {exportWarnings.slice(0, 6).map((warning) => (
            <div key={warning.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              {warning.message}
            </div>
          ))}
          {pendingBudgetItems.length === 0 && exportWarnings.length === 0 ? (
            <div className="rounded-2xl border bg-background/75 p-3 text-sm text-muted-foreground">Nenhum bloqueio crítico detectado no cenário atual.</div>
          ) : null}
        </div>
      </AdvancedDisclosure>
    </PageFrame>
  );
}

function formatExportCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}
