"use client";

import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createOperationalChecklist, type OperationalEnvironmentStatus, type OperationalChecklistTone } from "@/lib/operations/operational-checklist";
import { useProjectStore } from "@/lib/store/project-store";
import { cn } from "@/lib/utils";

const toneMeta: Record<OperationalChecklistTone, { badge: "outline" | "secondary"; icon: typeof CheckCircle2; className: string }> = {
  ok: {
    badge: "outline",
    icon: CheckCircle2,
    className: "text-emerald-700",
  },
  warning: {
    badge: "secondary",
    icon: CircleAlert,
    className: "text-amber-700",
  },
  muted: {
    badge: "secondary",
    icon: CircleDashed,
    className: "text-muted-foreground",
  },
};

export function OperationalChecklist({ environment }: { environment: OperationalEnvironmentStatus }) {
  const project = useProjectStore((state) => state.project);
  const checklist = createOperationalChecklist(environment, project);

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader>
        <CardTitle>Checklist operacional</CardTitle>
        <CardDescription>Estado seguro de IA, OpenAI e base de preços do projeto atual.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {checklist.map((item) => {
            const meta = toneMeta[item.tone];
            const Icon = meta.icon;
            return (
              <div key={item.id} className="rounded-md border bg-background/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className={cn("h-4 w-4 shrink-0", meta.className)} />
                    <p className="truncate text-sm font-medium">{item.label}</p>
                  </div>
                  <Badge variant={meta.badge}>{item.status}</Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
