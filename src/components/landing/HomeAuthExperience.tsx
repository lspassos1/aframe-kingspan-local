"use client";

import Link from "next/link";
import { SignIn, UserButton, useUser } from "@clerk/nextjs";
import { ArrowRight, Box, MessageSquare } from "lucide-react";
import { ApprovedContributions } from "@/components/landing/ApprovedContributions";
import { Button } from "@/components/ui/button";

export function HomeAuthExperience() {
  const { isLoaded, isSignedIn } = useUser();

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-neutral-950 text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-70 brightness-[0.68] contrast-[1.08] saturate-[0.9]"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/hero/aframe-transform-poster.svg"
        aria-label="Video de estudo A-frame com cabana moderna"
      >
        <source src="/hero/aframe-transform.webm" type="video/webm" />
        <source src="/hero/aframe-transform.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.16),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.42),rgba(0,0,0,0.82))]" />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="A-frame Estudo">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-neutral-950">
            <Box className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold tracking-normal">A-frame Estudo</span>
        </Link>
        <Button asChild variant="ghost" size="sm" className="text-white/75 hover:bg-white/10 hover:text-white">
          <Link href="/feedback">
            <MessageSquare className="mr-2 h-4 w-4" />
            Melhorias
          </Link>
        </Button>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100svh-88px)] w-full max-w-6xl flex-col items-center justify-center px-5 pb-16 pt-6 text-center">
        <div className="mb-7 max-w-2xl space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">Pre-projeto A-frame</p>
          <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-6xl">
            Entre para continuar seu estudo.
          </h1>
          <p className="mx-auto max-w-xl text-base leading-7 text-white/72">
            Configure lote, paineis, estrutura e custo preliminar em uma experiencia visual, salva no seu navegador.
          </p>
        </div>

        {!isLoaded ? (
          <div className="h-[430px] w-full max-w-[420px] animate-pulse rounded-md bg-white/12" aria-hidden="true" />
        ) : isSignedIn ? (
          <div className="w-full max-w-[420px] rounded-md border border-white/14 bg-white/92 p-5 text-left text-neutral-950 shadow-2xl shadow-black/25 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Sessao ativa</p>
                <p className="text-xs text-neutral-500">Voce ja esta logado neste navegador.</p>
              </div>
              <UserButton />
            </div>
            <Button asChild size="lg" className="mt-5 h-11 w-full rounded-full bg-neutral-950 text-white hover:bg-neutral-800">
              <Link href="/dashboard">
                Abrir app
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-md bg-white/96 p-1.5 shadow-2xl shadow-black/30 backdrop-blur">
            <SignIn
              routing="hash"
              signUpUrl="/"
              forceRedirectUrl="/start"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  cardBox: "shadow-none border-0",
                  card: "shadow-none border-0",
                  headerTitle: "text-neutral-950",
                  headerSubtitle: "text-neutral-500",
                  socialButtonsBlockButton:
                    "rounded-full border-neutral-200 hover:bg-neutral-50 text-neutral-950",
                  formButtonPrimary:
                    "rounded-full bg-neutral-950 hover:bg-neutral-800 normal-case",
                  footerActionLink: "text-neutral-950",
                },
              }}
            />
          </div>
        )}
      </section>

      <ApprovedContributions />
    </main>
  );
}
