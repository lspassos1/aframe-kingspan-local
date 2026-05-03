"use client";

import Image from "next/image";

export function HeroMedia() {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-md border bg-slate-950 shadow-sm">
      <video
        className="hidden h-full w-full object-cover motion-safe:block"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/hero/aframe-transform-poster.svg"
        aria-label="Animacao curta mostrando o estudo A-frame se transformando em uma casa pronta"
      >
        <source src="/hero/aframe-transform.webm" type="video/webm" />
        <source src="/hero/aframe-transform.mp4" type="video/mp4" />
      </video>
      <Image
        src="/hero/aframe-transform-poster.svg"
        alt="Modelo A-frame finalizado dentro de um lote, com estrutura, paineis e fachada"
        fill
        sizes="(min-width: 1024px) 52vw, 100vw"
        className="object-cover motion-safe:hidden"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-4 text-xs text-white/80">
        Modelo conceitual proprio, sem imagens de catalogo ou assets de terceiros.
      </div>
    </div>
  );
}
