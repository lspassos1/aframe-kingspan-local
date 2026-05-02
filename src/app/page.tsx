import Link from "next/link";
import { ArrowRight, FileSpreadsheet, LockKeyhole, MessageSquare, Ruler, ShieldCheck } from "lucide-react";
import { HeroMedia } from "@/components/landing/HeroMedia";
import { Button } from "@/components/ui/button";

const capabilities = [
  "Modelo 3D parametrico dentro do lote",
  "Quantitativos de paineis, acessorios e estrutura",
  "Orcamento preliminar separado por categorias",
  "Exportacao de listas e pedidos de cotacao",
];

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:px-8">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
            <Ruler className="h-4 w-4 text-primary" />
            Pre-projeto A-frame com 3D, materiais e custos
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
              Estude sua casa A-frame antes de comprar paineis ou contratar a obra.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Configure lote, painel, angulo, pavimento superior, estrutura preliminar, radier, materiais e cenario de custo
              em uma ferramenta focada em viabilidade.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Criar conta e iniciar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/sign-in">Entrar</Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-md border bg-card/70 p-3 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-3 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground md:grid-cols-3">
            <div className="flex gap-2">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Login via Clerk; o app nao armazena senhas.</span>
            </div>
            <div className="flex gap-2">
              <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Projetos seguem salvos no navegador nesta versao.</span>
            </div>
            <div className="flex gap-2">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Visitantes podem enviar melhorias sem criar conta.</span>
            </div>
          </div>
        </div>
        <HeroMedia />
      </section>
    </main>
  );
}
