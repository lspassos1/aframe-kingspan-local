import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Termos</p>
          <h1 className="text-3xl font-semibold tracking-normal">Uso preliminar, sem substituicao de projeto tecnico.</h1>
        </div>
        <div className="space-y-5 text-sm leading-7 text-muted-foreground">
          <p>
            A ferramenta serve para estudo preliminar de viabilidade, visualizacao 3D, orcamento estimativo e preparacao de
            conversas com fornecedores, arquiteto e engenheiro.
          </p>
          <p>
            Ela nao substitui projeto estrutural, projeto arquitetonico, ART/RRT, aprovacao municipal, sondagem de solo,
            calculo de fundacoes, verificacao completa de vento, detalhamento de ligacoes ou validacao tecnica do fornecedor.
          </p>
          <p>
            Marcas e nomes de fornecedores podem aparecer como referencia tecnica, catalogo ou cotacao fornecida pelo usuario.
            Nenhuma imagem de catalogo foi usada no video da pagina inicial.
          </p>
          <p>
            Os valores apresentados sao editaveis e devem ser confirmados por cotacao formal. Frete, impostos, disponibilidade,
            mao de obra e exigencias locais podem alterar significativamente o custo final.
          </p>
        </div>
        <Link href="/privacy" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Ver politica de privacidade
        </Link>
      </div>
    </main>
  );
}
