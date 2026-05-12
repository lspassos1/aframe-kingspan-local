"use client";

import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import { BudgetGroupCard, StatusPill } from "@/components/shared/design-system";
import { createOperationalChecklist, type OperationalEnvironmentStatus, type OperationalChecklistTone } from "@/lib/operations/operational-checklist";
import { useProjectStore } from "@/lib/store/project-store";
import { cn } from "@/lib/utils";

const toneMeta: Record<OperationalChecklistTone, { tone: "success" | "warning" | "neutral"; icon: typeof CheckCircle2; className: string }> = {
  ok: {
    tone: "success",
    icon: CheckCircle2,
    className: "text-emerald-700",
  },
  warning: {
    tone: "warning",
    icon: CircleAlert,
    className: "text-amber-700",
  },
  muted: {
    tone: "neutral",
    icon: CircleDashed,
    className: "text-muted-foreground",
  },
};

export function OperationalChecklist({ environment }: { environment: OperationalEnvironmentStatus }) {
  const project = useProjectStore((state) => state.project);
  const checklist = createOperationalChecklist(environment, project);

  return (
    <BudgetGroupCard
      title="Checklist operacional"
      description="Diagnóstico seguro de IA, limites, SINAPI e região do projeto atual."
      status={<StatusPill tone={checklist.some((item) => item.tone === "warning") ? "warning" : "success"}>{checklist.filter((item) => item.tone === "warning").length} ação(ões)</StatusPill>}
    >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {checklist.map((item) => {
            const meta = toneMeta[item.tone];
            const Icon = meta.icon;
            return (
              <div key={item.id} className="rounded-2xl border bg-background/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className={cn("h-4 w-4 shrink-0", meta.className)} />
                    <p className="truncate text-sm font-medium">{item.label}</p>
                  </div>
                  <StatusPill tone={meta.tone} icon={false}>{item.status}</StatusPill>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                {item.technicalDetail ? (
                  <details className="mt-3 rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-semibold text-foreground">Diagnóstico técnico</summary>
                    <p className="mt-2 leading-relaxed">{item.technicalDetail}</p>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
    </BudgetGroupCard>
  );
}
