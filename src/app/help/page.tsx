import { Bot, Database, FileQuestion, FileText, MapPinned, ShieldAlert } from "lucide-react";
import { OperationalChecklist } from "@/components/help/OperationalChecklist";
import { ActionCard, PageFrame, PageHeader, SectionHeader, StatusPill } from "@/components/shared/design-system";
import { createOperationalEnvironmentStatus } from "@/lib/operations/operational-environment";

const sections = [
  {
    title: "Como usar",
    body: "Comece pela planta baixa, por medidas simples ou por um exemplo. Depois revise Dados da obra, método, quantitativos, Base de preços, Orçamento, Visual 3D e Exportar.",
  },
  {
    title: "Preços",
    body: "O app não busca preços automaticamente. Cadastre fontes, importe CSV/XLSX/JSON/ZIP quando disponível ou gere pedidos de cotação para revisão humana.",
  },
  {
    title: "Estrutura A-frame",
    body: "A estrutura metálica permanece como pré-dimensionamento de viabilidade do método A-frame. Vento, fundações, ligações, ancoragens, flambagem e ART/RRT exigem responsável técnico.",
  },
  {
    title: "Salvar e carregar",
    body: "O projeto fica salvo no LocalStorage do navegador. Use Exportar para baixar JSON e Importar JSON para carregar em outro navegador ou computador.",
  },
  {
    title: "Documentos",
    body: "O projeto técnico gera desenhos e PDF preliminar. Use esses documentos para discutir opções, não como projeto executivo.",
  },
];

export default function HelpPage() {
  const operationalEnvironment = createOperationalEnvironmentStatus();
  const actions = [
    {
      title: "Upload/IA não aparece",
      body: operationalEnvironment.aiPlanExtractEnabled
        ? "Confira chave OpenAI, modelo e limites no ambiente do servidor."
        : "Ative a flag de extração e configure OpenAI no servidor.",
      icon: Bot,
      status: operationalEnvironment.aiPlanExtractEnabled ? "verificar chave" : "desligada",
    },
    {
      title: "Base de preço ausente",
      body: "Importe SINAPI ou base equivalente no Assistente de orçamento antes de aprovar vínculos.",
      icon: Database,
      status: "ação",
    },
    {
      title: "UF ou referência pendente",
      body: "Revise Dados da obra e metadados da base para filtros regionais consistentes.",
      icon: MapPinned,
      status: "revisar",
    },
    {
      title: "Relatório preliminar",
      body: "Exportações devem manter pendências, fonte, revisão humana e avisos técnicos visíveis.",
      icon: FileText,
      status: "preliminar",
    },
  ];

  return (
    <PageFrame>
      <PageHeader eyebrow="Ajuda" title="Operação do estudo" description="Diagnóstico, fluxo principal e limites técnicos em leitura curta." />
      <OperationalChecklist environment={operationalEnvironment} />
      <section className="space-y-4">
        <SectionHeader title="Ações de diagnóstico" description="Atalhos para entender por que IA, preço ou exportação ainda não estão prontos." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <ActionCard
              key={action.title}
              icon={action.icon}
              title={action.title}
              description={action.body}
              badge={<StatusPill tone="warning" icon={false}>{action.status}</StatusPill>}
              className="min-h-44"
            />
          ))}
        </div>
      </section>
      <SectionHeader title="Referência rápida" description="Limites e uso esperado sem texto longo na primeira camada." />
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section, index) => (
          <ActionCard
            key={section.title}
            icon={[FileQuestion, Database, ShieldAlert, FileText, FileText][index]}
            title={section.title}
            description={section.body}
          />
        ))}
      </div>
    </PageFrame>
  );
}
