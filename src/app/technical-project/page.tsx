"use client";

import { AlertTriangle, FileDown, FileText, Package, Ruler, ShieldAlert } from "lucide-react";
import { AdvancedDisclosure, BudgetGroupCard, MetricCard, PageFrame, PageHeader, SectionHeader, StatusPill } from "@/components/shared/design-system";
import { Button } from "@/components/ui/button";
import { exportTechnicalPdf } from "@/lib/export/files";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import { getTechnicalProjectViewModel } from "@/lib/technical-project";

export default function TechnicalProjectPage() {
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const technicalProject = getTechnicalProjectViewModel(project, scenario);
  const isDrawingMode = technicalProject.mode === "drawings";

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Projeto técnico"
        title={isDrawingMode ? "Desenhos preliminares gerados por SVG" : `Resumo técnico preliminar - ${technicalProject.methodName}`}
        description={
          isDrawingMode
            ? "Pranchas preliminares para conversa com fornecedores e responsáveis técnicos. Não substituem projeto executivo."
            : "Leitura curta dos quantitativos, alertas e próximos passos do método ativo. A memória técnica completa fica sob demanda."
        }
        status={<StatusPill tone="warning">Preliminar</StatusPill>}
        actions={
          <Button onClick={() => void exportTechnicalPdf(project, scenario)}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar PDF técnico
          </Button>
        }
      />

      {technicalProject.mode === "drawings" ? (
        <section className="space-y-4">
          <SectionHeader
            title="Pranchas para revisão"
            description="Use estas vistas para alinhar fornecedor e equipe técnica antes de qualquer detalhamento executivo."
            action={<StatusPill tone="info">{technicalProject.drawings.length} desenho(s)</StatusPill>}
          />
          <div className="grid gap-5 xl:grid-cols-2">
            {technicalProject.drawings.map((drawing) => (
              <BudgetGroupCard key={drawing.id} title={drawing.title} description="SVG preliminar, sem validade executiva.">
                <div
                  className="overflow-hidden rounded-2xl border bg-white"
                  dangerouslySetInnerHTML={{ __html: drawing.svg }}
                />
              </BudgetGroupCard>
            ))}
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Método" value={technicalProject.methodName} detail="Confirmar antes de orçamento" icon={<FileText className="h-4 w-4" />} />
            <MetricCard label="Métricas técnicas" value={technicalProject.metrics.length} detail="Resumo de geometria e método" icon={<Ruler className="h-4 w-4" />} />
            <MetricCard label="Quantitativos" value={technicalProject.materialLines.length} detail="Linhas preliminares" icon={<Package className="h-4 w-4" />} />
            <MetricCard
              label="Alertas"
              value={technicalProject.warnings.length}
              detail="Revisão humana obrigatória"
              tone={technicalProject.warnings.length > 0 ? "warning" : "success"}
              icon={<ShieldAlert className="h-4 w-4" />}
            />
          </div>

          <BudgetGroupCard
            title="Próximo passo técnico"
            description="Validar geometria, estrutura, fundação, ART/RRT, aprovação municipal, fornecedor e orçamento formal antes de qualquer execução."
            status={<StatusPill tone="warning">Revisável</StatusPill>}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {technicalProject.metrics.map((metric) => (
                <div className="rounded-2xl border bg-muted/20 p-3" key={metric.label}>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-lg font-semibold">{metric.value}</p>
                </div>
              ))}
            </div>
          </BudgetGroupCard>

          <section className="space-y-4">
            <SectionHeader
              title="Detalhes sob demanda"
              description="A primeira camada mostra decisão e risco; memória técnica e listas completas ficam recolhidas."
            />

            <AdvancedDisclosure
              title="Quantitativos preliminares"
              description="Linhas de materiais e serviços ainda dependem de fonte, revisão e aprovação técnica."
              icon={Package}
              badge={<StatusPill tone="neutral">{technicalProject.materialLines.length} linhas</StatusPill>}
            >
              <div className="divide-y rounded-2xl border bg-background">
                {technicalProject.materialLines.map((line) => (
                  <div className="grid gap-2 px-3 py-3 text-sm md:grid-cols-[1fr_140px]" key={line.id}>
                    <div>
                      <p className="font-medium">{line.description}</p>
                      <p className="text-xs text-muted-foreground">{line.code}</p>
                    </div>
                    <p className="text-muted-foreground md:text-right">
                      {line.quantity} {line.unit}
                    </p>
                  </div>
                ))}
              </div>
            </AdvancedDisclosure>

            <AdvancedDisclosure
              title="Alertas técnicos"
              description="Pendências que devem ser discutidas com fornecedores, arquiteto ou engenheiro."
              icon={AlertTriangle}
              badge={<StatusPill tone={technicalProject.warnings.length > 0 ? "warning" : "success"}>{technicalProject.warnings.length}</StatusPill>}
            >
              <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                {technicalProject.warnings.map((warning) => (
                  <li className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950" key={warning}>
                    {warning}
                  </li>
                ))}
              </ul>
            </AdvancedDisclosure>
          </section>
        </div>
      )}
    </PageFrame>
  );
}
