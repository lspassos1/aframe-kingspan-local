"use client";

import Link from "next/link";
import { useUser, UserButton } from "@clerk/nextjs";
import { ArrowRight, Box, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const details = [
  "Modelo 3D parametrico no navegador",
  "Materiais, estrutura e orcamento preliminar",
  "Projetos salvos localmente neste dispositivo",
];

function GoogleMark() {
  return (
    <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-sm font-semibold text-[#4285f4]">
      G
    </span>
  );
}

export function LandingLoginPanel() {
  const { isLoaded, isSignedIn } = useUser();

  return (
    <section className="order-2 flex min-h-[64svh] flex-col bg-[#f8f7f3] px-6 py-6 text-neutral-950 sm:px-10 lg:order-1 lg:min-h-[100svh] lg:px-14">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3" aria-label="A-frame Estudo">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-neutral-950 text-white">
            <Box className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold tracking-normal">A-frame Estudo</span>
        </Link>
        <Button asChild variant="ghost" size="sm" className="text-neutral-600 hover:bg-neutral-200/70">
          <Link href="/feedback">Melhorias</Link>
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center py-10 lg:py-12">
        <div className="mb-9 space-y-4">
          <p className="text-sm font-medium text-neutral-500">Pre-projeto A-frame com 3D e custos</p>
          <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
            Entre para continuar seu estudo.
          </h1>
          <p className="max-w-md text-base leading-7 text-neutral-600">
            Configure lote, paineis, estrutura e cenarios de custo antes de comprar materiais ou contratar a obra.
          </p>
        </div>

        {!isLoaded ? (
          <div className="h-56 animate-pulse rounded-md bg-neutral-200/70" aria-hidden="true" />
        ) : isSignedIn ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-medium">Sessao ativa</p>
                <p className="text-xs text-neutral-500">Voce ja esta logado neste navegador.</p>
              </div>
              <UserButton />
            </div>
            <Button asChild size="lg" className="h-12 w-full max-w-[400px] rounded-full bg-neutral-950 text-white hover:bg-neutral-800">
              <Link href="/dashboard">
                Abrir app
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <Button asChild size="lg" className="h-12 w-full max-w-[420px] rounded-full bg-neutral-950 text-white hover:bg-neutral-800">
              <Link href="/sign-in">
                <GoogleMark />
                Entrar com Google
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 w-full max-w-[420px] rounded-full border-neutral-300 bg-white hover:bg-neutral-100">
              <Link href="/sign-in">
                <Mail className="h-4 w-4" />
                Entrar com email
              </Link>
            </Button>
            <p className="pt-2 text-sm text-neutral-500">
              Ainda nao tem conta?{" "}
              <Link href="/sign-up" className="font-medium text-neutral-950 underline-offset-4 hover:underline">
                Criar conta
              </Link>
            </p>
          </div>
        )}

        <div className="mt-9 grid gap-3">
          {details.map((item) => (
            <div key={item} className="flex items-center gap-3 text-sm text-neutral-600">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="max-w-[560px] text-xs leading-5 text-neutral-500">
        Ao continuar, voce concorda com os termos de uso. O app usa Clerk para autenticacao e nao armazena senhas,
        hashes ou tokens OAuth.
      </p>
    </section>
  );
}
