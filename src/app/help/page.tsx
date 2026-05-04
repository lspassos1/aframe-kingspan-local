import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    title: "Como usar",
    body: "Comece em Configurar, ajuste metodo, endereco, lote e dados tecnicos. Depois confira Dashboard, Modelo 3D, Projeto Tecnico, Materiais, Orcamento e Cenarios. A tela Estrutura A-frame aparece somente para projetos A-frame.",
  },
  {
    title: "Precos",
    body: "O MVP nao busca precos automaticamente. Atualize valores manualmente, por CSV/XLSX exportado/importado externamente ou por pedidos de cotacao gerados na tela Cotacao.",
  },
  {
    title: "Estrutura A-frame",
    body: "A estrutura metalica e somente pre-dimensionamento para viabilidade do metodo A-frame. Vento, fundacoes, ligacoes, ancoragens, flambagem e ART/RRT exigem engenheiro habilitado.",
  },
  {
    title: "Salvar e carregar",
    body: "O projeto fica salvo no LocalStorage do navegador. Use Exportar para baixar JSON e Importar JSON para carregar em outro navegador ou computador.",
  },
  {
    title: "Documentos",
    body: "O projeto tecnico gera desenhos SVG parametrizados e PDF preliminar. Use esses documentos para discutir opcoes, nao como projeto executivo.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Ajuda</p>
        <h1 className="text-3xl font-semibold tracking-normal">Guia rapido</h1>
      </div>
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
