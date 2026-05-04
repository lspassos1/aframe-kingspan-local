"use client";

import { AlertTriangle, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportTechnicalPdf } from "@/lib/export/files";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";
import { getTechnicalProjectViewModel } from "@/lib/technical-project";

export default function TechnicalProjectPage() {
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const technicalProject = getTechnicalProjectViewModel(project, scenario);
  const isDrawingMode = technicalProject.mode === "drawings";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Projeto Tecnico</p>
          <h1 className="text-3xl font-semibold tracking-normal">
            {isDrawingMode ? "Desenhos preliminares gerados por SVG" : `Resumo tecnico preliminar - ${technicalProject.methodName}`}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isDrawingMode
              ? "Desenhos para discussao com fornecedores, arquiteto e engenheiro. Nao sao projeto executivo."
              : "Quantitativos e alertas do metodo selecionado para discussao com fornecedores, arquiteto e engenheiro. Nao sao projeto executivo."}
          </p>
        </div>
        <Button onClick={() => void exportTechnicalPdf(project, scenario)}>
          <FileDown className="mr-2 h-4 w-4" />
          Exportar PDF tecnico
        </Button>
      </div>

      {technicalProject.mode === "drawings" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {technicalProject.drawings.map((drawing) => (
            <Card className="rounded-md shadow-none" key={drawing.id}>
              <CardHeader>
                <CardTitle>{drawing.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="overflow-hidden rounded-md border bg-white"
                  dangerouslySetInnerHTML={{ __html: drawing.svg }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="space-y-6">
            <Card className="rounded-md shadow-none">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle>Metodo construtivo</CardTitle>
                <Badge variant="outline">Estimativa preliminar</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Selecionado</p>
                  <p className="mt-1 text-xl font-semibold">{technicalProject.methodName}</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Este resumo usa os calculos preliminares do metodo selecionado. Validar geometria, estrutura, fundacao, ART/RRT,
                  aprovacao municipal, fornecedor e orcamento formal antes de qualquer execucao.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-md shadow-none">
              <CardHeader>
                <CardTitle>Metricas tecnicas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {technicalProject.metrics.map((metric) => (
                    <div className="rounded-md border bg-muted/20 p-3" key={metric.label}>
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                      <p className="mt-1 text-lg font-semibold">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-md shadow-none">
              <CardHeader>
                <CardTitle>Quantitativos preliminares</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-md border">
                  {technicalProject.materialLines.slice(0, 10).map((line) => (
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
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6">
            <Card className="rounded-md shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Alertas tecnicos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                  {technicalProject.warnings.map((warning) => (
                    <li className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950" key={warning}>
                      {warning}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
