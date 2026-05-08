"use client";

import { Download, FileText, MailQuestion, PackageCheck } from "lucide-react";
import { AdvancedDisclosure, BudgetGroupCard, MetricCard, PageFrame, PageHeader, SectionHeader, StatusPill } from "@/components/shared/design-system";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateScenarioQuotationRequests } from "@/lib/construction-methods/scenario-calculations";
import { exportRfqText } from "@/lib/export/files";
import { useProjectStore, useSelectedScenario } from "@/lib/store/project-store";

export default function QuotationPage() {
  const project = useProjectStore((state) => state.project);
  const scenario = useSelectedScenario();
  const requests = generateScenarioQuotationRequests(project, scenario);
  const totalCharacters = requests.reduce((sum, request) => sum + request.body.length, 0);
  const firstRequest = requests[0];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Cotação"
        title="Pedidos de cotação revisáveis"
        description="Textos prontos por método construtivo, com itens preliminares e pontos a confirmar antes de enviar ao fornecedor."
        status={<StatusPill tone="warning">Preliminar</StatusPill>}
        actions={
          <Button onClick={() => exportRfqText(project.name, requests)}>
            <Download className="mr-2 h-4 w-4" />
            Baixar TXT
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Pedidos" value={requests.length} detail="Textos gerados para fornecedores" icon={<MailQuestion className="h-4 w-4" />} />
        <MetricCard label="Tamanho total" value={totalCharacters.toLocaleString("pt-BR")} detail="Caracteres revisáveis" icon={<FileText className="h-4 w-4" />} />
        <MetricCard label="Status" value="Revisar" detail="Não enviar sem validar escopo e fonte" tone="warning" icon={<PackageCheck className="h-4 w-4" />} />
      </section>

      {firstRequest ? (
        <BudgetGroupCard
          title="Próximo envio"
          description="Comece revisando o primeiro pedido. Os textos completos ficam recolhidos para evitar uma página dominada por textarea."
          status={<StatusPill tone="info">{firstRequest.title}</StatusPill>}
        >
          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{firstRequest.body}</p>
        </BudgetGroupCard>
      ) : null}

      <section className="space-y-4">
        <SectionHeader title="Textos completos" description="Abra cada pedido para revisar, ajustar e copiar o conteúdo integral." />

        <div className="grid gap-4 xl:grid-cols-2">
          {requests.map((request) => (
            <AdvancedDisclosure
              key={request.id}
              title={request.title}
              description="Pedido editável apenas por revisão manual antes de contato com fornecedor."
              badge={<StatusPill tone="neutral">{request.body.length.toLocaleString("pt-BR")} caracteres</StatusPill>}
            >
              <Textarea value={request.body} readOnly className="min-h-[420px] font-mono text-xs" />
            </AdvancedDisclosure>
          ))}
        </div>
      </section>
    </PageFrame>
  );
}
