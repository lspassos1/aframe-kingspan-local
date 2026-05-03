"use client";

import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { constructionMethodDefinitions, type ConstructionMethodId } from "@/lib/construction-methods";
import { cn } from "@/lib/utils";

const labelByValue = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
  slow: "Lenta",
  fast: "Rapida",
} as const;

export function ConstructionMethodSelector({
  selectedMethod,
  onSelect,
}: {
  selectedMethod: ConstructionMethodId;
  onSelect: (methodId: ConstructionMethodId) => void;
}) {
  return (
    <section className="rounded-md border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Metodo construtivo</h2>
        <p className="text-sm text-muted-foreground">Escolha o sistema de estudo para este cenario.</p>
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
        {constructionMethodDefinitions.map((definition) => {
          const active = definition.id === selectedMethod;
          return (
            <button
              key={definition.id}
              type="button"
              onClick={() => onSelect(definition.id)}
              className={cn(
                "rounded-md border bg-background p-4 text-left transition-colors hover:bg-muted/50",
                active && "border-primary bg-primary/5 ring-2 ring-primary/20"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{definition.name}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{definition.shortDescription}</p>
                </div>
                {active ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : null}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{definition.bestFor}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Badge variant="outline">Vel. {labelByValue[definition.speed]}</Badge>
                <Badge variant="outline">Comp. {labelByValue[definition.complexity]}</Badge>
                <Badge variant="outline">Ind. {labelByValue[definition.industrializationLevel]}</Badge>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
