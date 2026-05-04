"use client";

import { CheckCircle2, ChevronDown, Gauge, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { constructionMethodDefinitions, type ConstructionMethodId } from "@/lib/construction-methods";
import { cn } from "@/lib/utils";

const labelByValue = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  slow: "Lenta",
  fast: "Rápida",
} as const;

export function ConstructionMethodSelector({
  selectedMethod,
  onSelect,
}: {
  selectedMethod: ConstructionMethodId;
  onSelect: (methodId: ConstructionMethodId) => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-card/90 shadow-sm shadow-foreground/5">
      <div className="flex flex-col gap-1 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Método construtivo</p>
          <h2 className="text-xl font-semibold tracking-normal">Escolha o sistema do estudo</h2>
        </div>
        <p className="text-sm text-muted-foreground">O A-frame mantém o fluxo completo; os demais usam MVP preliminar.</p>
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
        {constructionMethodDefinitions.map((definition) => {
          const active = definition.id === selectedMethod;
          const visibleLimitations = definition.limitations.slice(0, 1);
          return (
            <article
              key={definition.id}
              className={cn(
                "group rounded-2xl border bg-background/80 p-4 shadow-sm shadow-foreground/5 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background hover:shadow-md",
                active && "border-primary/50 bg-primary/[0.035] ring-2 ring-primary/15"
              )}
            >
              <button type="button" aria-pressed={active} onClick={() => onSelect(definition.id)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold tracking-normal">{definition.name}</p>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{definition.bestFor}</p>
                  </div>
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors",
                      active && "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    {active ? <CheckCircle2 className="h-4 w-4" /> : <Gauge className="h-3.5 w-3.5" />}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-foreground/82">{definition.shortDescription}</p>
              </button>
              <div className="mt-4 grid gap-1.5">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">Vel. {labelByValue[definition.speed]}</Badge>
                  <Badge variant="outline">Comp. {labelByValue[definition.complexity]}</Badge>
                  <Badge variant="outline">Ind. {labelByValue[definition.industrializationLevel]}</Badge>
                </div>
                <details className="group/details mt-2 text-xs text-muted-foreground" onClick={(event) => event.stopPropagation()}>
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-foreground/75">
                    <Info className="h-3.5 w-3.5" />
                    Alertas e limites
                    <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open/details:rotate-180" />
                  </summary>
                  <div className="mt-2 space-y-2 rounded-xl bg-muted/55 p-3">
                    {visibleLimitations.map((limitation) => (
                      <p key={limitation}>{limitation}</p>
                    ))}
                    {definition.defaultWarnings.slice(0, 2).map((warning) => (
                      <p key={warning.id}>{warning.message}</p>
                    ))}
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
