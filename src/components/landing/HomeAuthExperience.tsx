"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  FileDown,
  FileText,
  FileUp,
  MessageSquare,
  PenLine,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const workflow = [
  { label: "Planta enviada", detail: "PDF ou imagem", icon: FileUp, tone: "bg-cyan-50 text-cyan-950 border-cyan-200" },
  { label: "Dados extraídos", detail: "Medidas com evidência", icon: PenLine, tone: "bg-white text-slate-950 border-slate-200" },
  { label: "Perguntas pendentes", detail: "Escala, UF e premissas", icon: CircleHelp, tone: "bg-amber-50 text-amber-950 border-amber-200" },
  { label: "Quantitativos", detail: "Sistema calcula", icon: ClipboardCheck, tone: "bg-emerald-50 text-emerald-950 border-emerald-200" },
  { label: "Fonte de preço", detail: "SINAPI ou base importada", icon: WalletCards, tone: "bg-indigo-50 text-indigo-950 border-indigo-200" },
  { label: "Exportação", detail: "JSON, XLSX e PDF", icon: FileDown, tone: "bg-slate-950 text-white border-slate-950" },
];

const budgetRows = [
  { code: "SINAPI 87489", item: "Alvenaria de vedação", value: "R$ 9.600", status: "Fonte BA 05/2026" },
  { code: "PENDENTE", item: "Fundação preliminar", value: "A revisar", status: "Responsável técnico" },
  { code: "REGRA", item: "Pontos elétricos", value: "34 un", status: "Confirmar média" },
];

const rules = [
  "IA sugere dados visíveis e perguntas.",
  "O sistema calcula quantitativos por regra.",
  "Preço só entra com fonte e revisão.",
  "Orçamento permanece preliminar.",
];

export function HomeAuthExperience() {
  const { isLoaded, isSignedIn } = useUser();
  const primaryHref = isLoaded && isSignedIn ? "/start?mode=ai" : "/sign-up";
  const exampleHref = isLoaded && isSignedIn ? "/start?mode=example" : "/sign-up";

  return (
    <main className="bg-[#f6f8f5] text-slate-950">
      <section className="min-h-[92svh] border-b border-slate-950/10 px-5 sm:px-8 lg:px-12">
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-5">
          <Link href="/" className="flex items-center gap-3" aria-label="Estudo Construtivo">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white shadow-sm">
              <Box className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold tracking-normal">Estudo Construtivo</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden text-slate-600 hover:bg-white hover:text-slate-950 sm:inline-flex">
              <Link href="/feedback">
                <MessageSquare className="h-4 w-4" />
                Melhorias
              </Link>
            </Button>
            {!isLoaded ? (
              <div className="h-8 w-32" aria-hidden="true" />
            ) : isSignedIn ? (
              <>
                <Button asChild size="sm" className="bg-slate-950 text-white hover:bg-slate-800">
                  <Link href="/dashboard">Abrir app</Link>
                </Button>
                <UserButton />
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="text-slate-600 hover:bg-white hover:text-slate-950">
                  <Link href="/sign-in">Entrar</Link>
                </Button>
                <Button asChild size="sm" className="bg-slate-950 text-white hover:bg-slate-800">
                  <Link href="/sign-up">Criar conta</Link>
                </Button>
              </>
            )}
          </nav>
        </header>

        <div className="mx-auto grid max-w-7xl gap-10 pb-14 pt-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:pb-20 lg:pt-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pré-orçamento assistido</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-balance sm:text-6xl">
              Envie sua planta. Confirme os dados. Gere um orçamento preliminar com fonte.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
              A experiência começa pela planta baixa ou por medidas simples. A IA sugere, o sistema calcula e você decide o que entra no estudo.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-11 rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800">
                <Link href={primaryHref}>
                  Enviar planta
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-full border-slate-300 bg-white px-6 text-slate-950 hover:bg-slate-50">
                <Link href={exampleHref}>Ver exemplo</Link>
              </Button>
            </div>
            <div className="mt-8 grid max-w-xl gap-2 sm:grid-cols-3">
              {["IA sugere", "Sistema calcula", "Usuário aprova"].map((label) => (
                <span key={label} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <ProductWorkflowPreview />
        </div>
      </section>

      <section className="bg-white px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
          <div>
            <p className="text-sm text-slate-500">Fluxo real</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-normal sm:text-4xl">Mostre, revise e aprove antes de exportar.</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {workflow.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className={`min-h-36 rounded-3xl border p-4 ${item.tone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="h-5 w-5" />
                    <span className="font-mono text-xs opacity-60">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-8 font-semibold">{item.label}</h3>
                  <p className="mt-1 text-sm opacity-75">{item.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/5">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Orçamento preliminar</p>
                  <h2 className="mt-2 text-2xl font-semibold">Rastreabilidade antes do total</h2>
                </div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950">2 pendências</span>
              </div>
              <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                {budgetRows.map((row) => (
                  <div key={row.item} className="grid gap-3 p-4 text-sm sm:grid-cols-[120px_1fr_110px_150px] sm:items-center">
                    <span className="font-mono text-xs text-slate-500">{row.code}</span>
                    <span className="font-medium">{row.item}</span>
                    <span>{row.value}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{row.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-500">Regra de confiança</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-normal sm:text-4xl">A IA não inventa preço. O orçamento não se aprova sozinho.</h2>
            <div className="mt-6 grid gap-3">
              {rules.map((rule) => (
                <div key={rule} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-amber-900/20 bg-amber-100 px-5 py-10 sm:px-8 lg:px-12">
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
            <p className="text-sm text-slate-500">Começar agora</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-normal sm:text-4xl">Abra um estudo pela planta baixa.</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800">
              <Link href={primaryHref}>
                Enviar planta
                <FileText className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-6">
              <Link href={exampleHref}>Ver exemplo</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function ProductWorkflowPreview() {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-950/10">
      <div className="rounded-[1.55rem] border border-slate-200 bg-[#f8faf8] p-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Estudo Casa Jardim</p>
            <h2 className="mt-1 text-xl font-semibold">Revisão da planta</h2>
          </div>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-950">Análise pronta</span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="aspect-[4/3] rounded-xl border border-dashed border-slate-300 bg-[linear-gradient(90deg,#e2e8f0_1px,transparent_1px),linear-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:28px_28px] p-3">
              <div className="grid h-full grid-cols-2 gap-2">
                <div className="rounded-lg border-2 border-slate-500 bg-white/80 p-2 text-xs font-medium">Sala 18 m²</div>
                <div className="rounded-lg border-2 border-slate-500 bg-white/80 p-2 text-xs font-medium">Quarto 11 m²</div>
                <div className="rounded-lg border-2 border-slate-500 bg-white/80 p-2 text-xs font-medium">Cozinha 9 m²</div>
                <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-2 text-xs font-medium">Banho ?</div>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium">planta-baixa.pdf</p>
            <p className="text-xs text-slate-500">Cache por hash ativo. Nada aplicado automaticamente.</p>
          </div>

          <div className="space-y-3">
            <PreviewDecision title="Área e dimensões" value="80 m²" status="Confiança média" />
            <PreviewDecision title="Pergunta pendente" value="Qual medida real confirma a escala?" status="Obrigatória" tone="warning" />
            <PreviewDecision title="Quantitativos" value="12 seeds geradas" status="Revisão humana" tone="success" />
            <PreviewDecision title="Orçamento" value="Fonte SINAPI BA 05/2026" status="Pendente parcial" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewDecision({
  title,
  value,
  status,
  tone = "neutral",
}: {
  title: string;
  value: string;
  status: string;
  tone?: "neutral" | "warning" | "success";
}) {
  const statusClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
        : "border-slate-200 bg-white text-slate-950";

  return (
    <div className={`rounded-2xl border p-3 ${statusClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-60">{title}</p>
          <p className="mt-1 font-semibold">{value}</p>
        </div>
        <CheckCircle2 className="h-4 w-4 opacity-60" />
      </div>
      <p className="mt-2 text-xs opacity-70">{status}</p>
    </div>
  );
}
