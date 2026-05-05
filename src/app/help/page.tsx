import { OperationalChecklist } from "@/components/help/OperationalChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Ajuda</p>
        <h1 className="text-3xl font-semibold tracking-normal">Guia rápido</h1>
      </div>
      <OperationalChecklist environment={operationalEnvironment} />
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card className="rounded-md shadow-none" key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{section.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
