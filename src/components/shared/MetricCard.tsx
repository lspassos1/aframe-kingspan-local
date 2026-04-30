import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  detail,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-md border-border/70 shadow-none", className)}>
      <CardContent className="flex min-h-28 items-start justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
          {detail ? <div className="mt-2 text-xs text-muted-foreground">{detail}</div> : null}
        </div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </CardContent>
    </Card>
  );
}
