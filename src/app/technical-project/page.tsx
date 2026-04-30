"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateAssemblyDrawings } from "@/lib/calculations/drawings";
import { exportTechnicalPdf } from "@/lib/export/files";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

export default function TechnicalProjectPage() {
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const drawings = generateAssemblyDrawings(project, scenario);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Projeto Tecnico</p>
          <h1 className="text-3xl font-semibold tracking-normal">Desenhos preliminares gerados por SVG</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Desenhos para discussao com fornecedores, arquiteto e engenheiro. Nao sao projeto executivo.
          </p>
        </div>
        <Button onClick={() => void exportTechnicalPdf(project, scenario)}>
          <FileDown className="mr-2 h-4 w-4" />
          Exportar PDF tecnico
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {drawings.map((drawing) => (
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
    </div>
  );
}
