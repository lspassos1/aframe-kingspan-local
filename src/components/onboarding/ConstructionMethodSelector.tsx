"use client";

import { CheckCircle2, ChevronDown, Circle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { constructionMethodDefinitions, type ConstructionMethodId } from "@/lib/construction-methods";
import { getMethodSelectorCardCopy } from "@/lib/onboarding/construction-method-selector";
import { cn } from "@/lib/utils";

export function ConstructionMethodSelector({
  selectedMethod,
  onSelect,
}: {
  selectedMethod: ConstructionMethodId;
  onSelect: (methodId: ConstructionMethodId) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card/90 shadow-sm shadow-foreground/5">
      <div className="flex flex-col gap-1 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Método construtivo</p>
          <h2 className="text-xl font-semibold tracking-normal">Confirme o sistema do estudo</h2>
        </div>
        <p className="text-sm text-muted-foreground">Você pode revisar esta escolha depois.</p>
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
        {constructionMethodDefinitions.map((definition) => {
          const active = definition.id === selectedMethod;
          const copy = getMethodSelectorCardCopy(definition);
          return (
            <article
              key={definition.id}
              className={cn(
                "group rounded-lg border bg-background/80 p-4 shadow-sm shadow-foreground/5 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background hover:shadow-md",
                active && "border-primary/50 bg-primary/[0.035] ring-2 ring-primary/15"
              )}
            >
              <button type="button" aria-pressed={active} onClick={() => onSelect(definition.id)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold tracking-normal">{copy.displayName}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.visibleDescription}</p>
                  </div>
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors",
                      active && "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    {active ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5" />}
                  </span>
                </div>
              </button>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {copy.chips.map((chip, index) => (
                  <Badge variant={index === 0 ? "secondary" : "outline"} key={chip}>
                    {chip}
                  </Badge>
                ))}
              </div>
              <details className="group/details mt-4 text-xs text-muted-foreground" onClick={(event) => event.stopPropagation()}>
                <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-foreground/75">
                  <Info className="h-3.5 w-3.5" />
                  Detalhes técnicos
                  <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open/details:rotate-180" />
                </summary>
                <div className="mt-2 space-y-3 rounded-lg bg-muted/55 p-3">
                  <div>
                    <p className="font-medium text-foreground/80">Uso indicado</p>
                    <p className="mt-1 leading-5">{definition.bestFor}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground/80">Limites e alertas</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {definition.limitations.slice(0, 2).map((limitation) => (
                        <li key={limitation}>{limitation}</li>
                      ))}
                      {definition.defaultWarnings.slice(0, 1).map((warning) => (
                        <li key={warning.id}>{warning.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
