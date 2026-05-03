import Image from "next/image";

export function LandingVideoPlane() {
  return (
    <section className="relative order-1 min-h-[42svh] overflow-hidden bg-neutral-950 lg:order-2 lg:min-h-[100svh]">
      <video
        className="hidden h-full min-h-[42svh] w-full object-cover brightness-[0.72] contrast-[1.08] saturate-[0.92] motion-safe:block lg:min-h-[100svh]"
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
        priority
        sizes="(min-width: 1024px) 52vw, 100vw"
        className="object-cover brightness-[0.72] contrast-[1.08] saturate-[0.92] motion-safe:hidden"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_8%,rgba(255,255,255,0.22),transparent_24%),linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.38)_48%,rgba(0,0,0,0.08))]" />
      <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-6 text-white sm:inset-x-10 lg:inset-x-12 lg:bottom-10">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/55">visualizacao local</p>
          <p className="mt-2 max-w-sm text-2xl font-semibold tracking-normal text-balance">
            Do lote ao modelo em uma unica superficie de estudo.
          </p>
        </div>
        <div className="hidden border-l border-white/20 pl-5 text-xs leading-5 text-white/65 xl:block">
          Painel, estrutura, frete, civil e cotacao preliminar.
        </div>
      </div>
    </section>
  );
}
