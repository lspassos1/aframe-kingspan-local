"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { generateScenarioQuotationRequests } from "@/lib/construction-methods/scenario-calculations";
import { exportRfqText } from "@/lib/export/files";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

export default function QuotationPage() {
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const requests = generateScenarioQuotationRequests(project, scenario);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Cotacao</p>
          <h1 className="text-3xl font-semibold tracking-normal">Pedidos de cotacao em portugues</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Textos prontos por metodo construtivo, sempre com status preliminar e itens a confirmar.
          </p>
        </div>
        <Button onClick={() => exportRfqText(project.name, requests)}>
          <Download className="mr-2 h-4 w-4" />
          Baixar TXT
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {requests.map((request) => (
          <Card className="rounded-md shadow-none" key={request.id}>
            <CardHeader>
              <CardTitle>{request.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={request.body} readOnly className="min-h-[420px] font-mono text-xs" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
