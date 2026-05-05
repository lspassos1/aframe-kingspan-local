"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { ArrowRight, Box, Calculator, CheckCircle2, ClipboardList, FileDown, FileText, FileUp, MessageSquare, PenLine, ShieldCheck, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";

const decisionSteps = [
  {
    title: "IA lê e sugere",
    body: "Com OpenAI ativa, a planta vira campos preliminares, pendências e incertezas para revisão.",
  },
  {
    title: "Sistema calcula",
    body: "Quantitativos, geometria, 3D e orçamento usam regras determinísticas do método confirmado.",
  },
  {
    title: "Usuário aprova",
    body: "Nada entra no orçamento revisado sem fonte, status e aceite humano.",
  },
];

const workflow = [
  { label: "Planta", detail: "PDF ou imagem", icon: FileUp },
  { label: "Revisão", detail: "Campos editáveis", icon: PenLine },
  { label: "Método", detail: "Escolha revisável", icon: ClipboardList },
  { label: "Base", detail: "Preço com origem", icon: WalletCards },
  { label: "Orçamento", detail: "Prévia exportável", icon: Calculator },
  { label: "Exportação", detail: "JSON, XLSX e PDF", icon: FileDown },
];

const sourceRules = [
  "Preço sem fonte fica pendente.",
  "IA não inventa composição nem valor.",
  "SINAPI entra por importação controlada.",
  "Fluxos existentes continuam preservados.",
];

export function HomeAuthExperience() {
  const { isLoaded, isSignedIn } = useUser();
  const primaryHref = isLoaded && isSignedIn ? "/start?mode=ai" : "/sign-up";

  return (
    <main className="bg-[#f6f7f4] text-neutral-950">
      <section className="relative min-h-[82svh] overflow-hidden bg-neutral-950 text-white">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-72 brightness-[0.5] contrast-[1.08] saturate-[0.85]"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero/aframe-transform-poster.svg"
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/hero/aframe-transform.webm" type="video/webm" />
          <source src="/hero/aframe-transform.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.88),rgba(5,5,5,0.56)_45%,rgba(5,5,5,0.18)),linear-gradient(180deg,rgba(5,5,5,0.2),rgba(5,5,5,0.78))]" />

        <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-3" aria-label="Estudo Construtivo">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-neutral-950">
              <Box className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold tracking-normal">Estudo Construtivo</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden text-white/72 hover:bg-white/10 hover:text-white sm:inline-flex">
              <Link href="/feedback">
                <MessageSquare className="h-4 w-4" />
                Melhorias
              </Link>
            </Button>
            {!isLoaded ? (
              <div className="h-8 w-32" aria-hidden="true" />
            ) : isSignedIn ? (
              <>
                <Button asChild size="sm" className="bg-white text-neutral-950 hover:bg-white/90">
                  <Link href="/dashboard">Abrir app</Link>
                </Button>
                <UserButton />
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="text-white/72 hover:bg-white/10 hover:text-white">
                  <Link href="/sign-in">Entrar</Link>
                </Button>
                <Button asChild size="sm" className="bg-white text-neutral-950 hover:bg-white/90">
                  <Link href="/sign-up">Criar conta</Link>
                </Button>
              </>
            )}
          </nav>
        </header>

        <div className="relative z-10 flex min-h-[calc(82svh-80px)] items-center px-5 pb-16 pt-8 sm:px-8 lg:px-12">
          <div className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-200/80">Pré-orçamento assistido</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-normal text-balance sm:text-6xl lg:text-7xl">
              Orçamento preliminar de obra a partir da planta baixa.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/76 sm:text-lg">
              Envie a planta, revise os dados e gere quantitativos com fonte de preço. O método construtivo entra depois,
              como escolha ou sugestão revisável.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-11 rounded-full bg-white px-6 text-neutral-950 hover:bg-white/90">
                <Link href={primaryHref}>
                  Começar com planta
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-full border-white/35 bg-white/5 px-6 text-white hover:bg-white/12 hover:text-white">
                <Link href="#exemplo">Ver exemplo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="exemplo" className="border-b border-neutral-950/10 px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm text-neutral-500">Como a decisão acontece</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-normal sm:text-4xl">A IA sugere. O sistema calcula. Você aprova.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {decisionSteps.map((step) => (
              <div key={step.title} className="border-t border-neutral-950/18 pt-4">
                <CheckCircle2 className="mb-4 h-5 w-5 text-emerald-700" />
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm text-neutral-500">Fluxo principal</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">Planta, revisão e preço antes de qualquer relatório.</h2>
          </div>
          <div className="grid gap-0 border-y border-neutral-950/14 md:grid-cols-3 xl:grid-cols-6">
            {workflow.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="group min-h-36 border-b border-neutral-950/10 py-5 transition-colors hover:bg-white md:border-r md:px-5 xl:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <Icon className="h-5 w-5 text-neutral-500 transition-colors group-hover:text-emerald-700" />
                    <span className="font-mono text-xs text-neutral-400">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-8 text-lg font-semibold">{item.label}</h3>
                  <p className="mt-1 text-sm text-neutral-500">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-neutral-950 px-5 py-16 text-white sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm text-white/50">Base de preços</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-normal sm:text-4xl">
              Orçamento preliminar só aparece com fonte, status e revisão.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/66">
              O app transforma quantitativos em linhas de orçamento, mas mantém pendente o que não tiver preço válido, UF,
              referência, unidade compatível e revisão humana.
            </p>
          </div>
          <div className="divide-y divide-white/12 border-y border-white/12">
            {sourceRules.map((rule) => (
              <div key={rule} className="flex items-center gap-3 py-4 text-sm text-white/78">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm text-neutral-500">Saída do estudo</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-normal sm:text-4xl">Quantitativos, 3D e exportação no mesmo fluxo.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-600">
              Depois da revisão, o app mostra orçamento preliminar, visualização 3D e arquivos para continuar a conversa com fornecedores.
            </p>
          </div>
          <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-neutral-950">
            <video
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/hero/aframe-transform-poster.svg"
              aria-hidden="true"
              tabIndex={-1}
            >
              <source src="/hero/aframe-transform.webm" type="video/webm" />
              <source src="/hero/aframe-transform.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-neutral-950/86 to-transparent p-4 text-sm text-white/78">
              Estudo visual para revisar método, quantitativos e pendências.
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-amber-900/20 bg-[#f1dfb5] px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-xl font-semibold tracking-normal">Aviso técnico</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-neutral-800">
            A estimativa é preliminar e não substitui projeto executivo, ART/RRT, aprovação municipal, sondagem ou orçamento formal revisado.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-neutral-500">Começar agora</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-normal sm:text-4xl">Abra um estudo pela planta baixa.</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 rounded-full px-6">
              <Link href={primaryHref}>
                Começar com planta
                <FileText className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-6">
              <Link href={isLoaded && isSignedIn ? "/dashboard" : "/sign-in"}>{isLoaded && isSignedIn ? "Abrir app" : "Entrar"}</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
