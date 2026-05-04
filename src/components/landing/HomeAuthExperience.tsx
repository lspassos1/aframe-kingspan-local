"use client";

import Link from "next/link";
import { SignIn, UserButton, useUser } from "@clerk/nextjs";
import { ArrowRight, Box, CheckCircle2, ClipboardList, Layers3, MessageSquare, ShieldCheck, WalletCards } from "lucide-react";
import { ApprovedContributions } from "@/components/landing/ApprovedContributions";
import { Button } from "@/components/ui/button";

const methods = [
  {
    name: "A-frame com painéis",
    description: "Modelo atual preservado, com geometria inclinada, painéis, estrutura preliminar e 3D completo.",
  },
  {
    name: "Alvenaria convencional",
    description: "Estimativa inicial para blocos, revestimentos, fundação e placeholders de estrutura e mão de obra.",
  },
  {
    name: "Bloco ecológico",
    description: "Quantitativos preliminares de solo-cimento, modulação, graute, armaduras e acabamento aparente ou rebocado.",
  },
  {
    name: "Painéis monolíticos EPS",
    description: "Levantamento de painéis, malha, revestimento por face, arranques e reforços para cotação com fornecedor.",
  },
];

const workflow = [
  "Escolha o método construtivo",
  "Informe lote, dimensões e premissas técnicas",
  "Compare 3D, quantitativos, custo preliminar e alertas",
  "Exporte relatórios, materiais e pedidos de cotação",
];

const calculations = [
  "Geometria e áreas por cenário",
  "Materiais e perdas preliminares",
  "Orçamento com fonte, data, unidade e confiança",
  "Alertas técnicos e itens pendentes de revisão",
];

export function HomeAuthExperience() {
  const { isLoaded, isSignedIn } = useUser();

  return (
    <main className="bg-[#f5f3ed] text-neutral-950">
      <section className="relative min-h-[86svh] overflow-hidden bg-neutral-950 text-white">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-80 brightness-[0.58] contrast-[1.08] saturate-[0.92]"
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
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.82),rgba(0,0,0,0.42)_48%,rgba(0,0,0,0.18)),linear-gradient(180deg,rgba(0,0,0,0.24),rgba(0,0,0,0.72))]" />

        <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Construção Estudo">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-neutral-950">
              <Box className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold tracking-normal">Construção Estudo</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden text-white/75 hover:bg-white/10 hover:text-white sm:inline-flex">
              <Link href="/feedback">
                <MessageSquare className="mr-2 h-4 w-4" />
                Melhorias
              </Link>
            </Button>
            {isLoaded && isSignedIn ? <UserButton /> : null}
          </nav>
        </header>

        <div className="relative z-10 flex min-h-[calc(86svh-80px)] items-center px-5 pb-14 pt-8 sm:px-8 lg:px-12">
          <div className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/60">Plataforma modular de pré-projeto</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-balance sm:text-6xl lg:text-7xl">
              Projete e estime sua construção em minutos.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/74 sm:text-lg">
              Escolha o método construtivo, configure o lote, visualize em 3D e gere uma estimativa técnica com materiais, custos e alertas.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {isLoaded && isSignedIn ? (
                <Button asChild size="lg" className="h-11 rounded-full bg-white px-6 text-neutral-950 hover:bg-white/90">
                  <Link href="/dashboard">
                    Abrir app
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="h-11 rounded-full bg-white px-6 text-neutral-950 hover:bg-white/90">
                    <Link href="/sign-up">
                      Criar conta
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-11 rounded-full border-white/35 bg-white/5 px-6 text-white hover:bg-white/12 hover:text-white">
                    <Link href="/sign-in">Entrar</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <ApprovedContributions />
      </section>

      <section className="border-y border-neutral-950/10 bg-[#f5f3ed] px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm text-neutral-500">Métodos construtivos</p>
              <h2 className="mt-2 max-w-md text-3xl font-semibold tracking-normal sm:text-4xl">Comece pelo sistema da obra.</h2>
            </div>
            <div className="grid gap-x-8 gap-y-7 md:grid-cols-2">
              {methods.map((method) => (
                <div key={method.name} className="border-t border-neutral-950/20 pt-4">
                  <h3 className="text-lg font-semibold">{method.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{method.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <p className="text-sm text-neutral-500">Como funciona</p>
            <h2 className="mt-2 max-w-lg text-3xl font-semibold tracking-normal sm:text-4xl">Um fluxo técnico para sair da ideia e chegar na cotação.</h2>
          </div>
          <div className="divide-y divide-neutral-950/12 border-y border-neutral-950/12">
            {workflow.map((item, index) => (
              <div key={item} className="grid gap-4 py-6 sm:grid-cols-[80px_1fr]">
                <span className="font-mono text-sm text-neutral-400">{String(index + 1).padStart(2, "0")}</span>
                <p className="text-xl font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-neutral-950 px-5 py-16 text-white sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm text-white/50">O que o app calcula</p>
            <h2 className="mt-2 max-w-md text-3xl font-semibold tracking-normal sm:text-4xl">Dados preliminares para decidir o próximo passo.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {calculations.map((item) => (
              <div key={item} className="flex gap-3 border-t border-white/14 pt-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <p className="text-sm leading-6 text-white/76">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-neutral-500">Exemplo visual 3D</p>
              <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-normal sm:text-4xl">Visualize o método antes de pedir preço.</h2>
            </div>
            <div className="grid max-w-md gap-3 text-sm text-neutral-600 sm:grid-cols-3">
              <span className="flex items-center gap-2">
                <Layers3 className="h-4 w-4" />
                Camadas
              </span>
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Quantitativos
              </span>
              <span className="flex items-center gap-2">
                <WalletCards className="h-4 w-4" />
                Orçamento
              </span>
            </div>
          </div>
          <div className="relative aspect-[16/8] overflow-hidden rounded-md bg-neutral-950">
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
          </div>
        </div>
      </section>

      <section className="border-y border-amber-900/20 bg-[#efe3c4] px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6" />
            <h2 className="text-2xl font-semibold tracking-normal">Aviso técnico</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-neutral-800">
            A estimativa é preliminar. O app não substitui projeto estrutural, projeto arquitetônico, ART/RRT, aprovação municipal, sondagem,
            validação técnica do fornecedor, compatibilização de instalações ou orçamento formal revisado.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_420px] lg:items-start">
          <div>
            <p className="text-sm text-neutral-500">Login / criar conta</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-normal sm:text-4xl">Salve estudos no navegador e continue quando precisar.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-600">
              Autenticação via Clerk. Projetos continuam no navegador e podem ser exportados em JSON, CSV, XLSX e PDF.
            </p>
          </div>
          {!isLoaded ? (
            <div className="h-[420px] animate-pulse rounded-md bg-neutral-200" aria-hidden="true" />
          ) : isSignedIn ? (
            <div className="rounded-md border border-neutral-950/12 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Sessão ativa</p>
                  <p className="text-xs text-neutral-500">Você já está logado neste navegador.</p>
                </div>
                <UserButton />
              </div>
              <Button asChild size="lg" className="mt-5 h-11 w-full rounded-full">
                <Link href="/dashboard">
                  Abrir app
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-md border border-neutral-950/12 bg-white p-1.5 shadow-sm">
              <SignIn
                routing="hash"
                signUpUrl="/sign-up"
                forceRedirectUrl="/start"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    cardBox: "shadow-none border-0",
                    card: "shadow-none border-0",
                    headerTitle: "text-neutral-950",
                    headerSubtitle: "text-neutral-500",
                    socialButtonsBlockButton: "rounded-full border-neutral-200 hover:bg-neutral-50 text-neutral-950",
                    formButtonPrimary: "rounded-full bg-neutral-950 hover:bg-neutral-800 normal-case",
                    footerActionLink: "text-neutral-950",
                  },
                }}
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
