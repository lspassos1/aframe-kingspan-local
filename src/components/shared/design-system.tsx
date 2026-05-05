import type { ComponentType, ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Clock3, FileUp, Info, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type VisualIcon = ComponentType<{ className?: string }>;
type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "pending";

const toneClasses: Record<Tone, string> = {
  neutral: "border-border/80 bg-background/75 text-foreground",
  info: "border-sky-200 bg-sky-50 text-sky-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-destructive/30 bg-destructive/5 text-destructive",
  pending: "border-violet-200 bg-violet-50 text-violet-950",
};

const toneIcons: Record<Tone, VisualIcon> = {
  neutral: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  danger: XCircle,
  pending: Clock3,
};

export function PageFrame({
  children,
  className,
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "narrow" | "wide";
}) {
  return (
    <div
      data-slot="page-frame"
      className={cn(
        "w-full space-y-6",
        size === "narrow" && "mx-auto max-w-5xl",
        size === "wide" && "mx-auto max-w-[1600px]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  status,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  className?: string;
}) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "rounded-2xl border bg-card/86 p-5 shadow-sm shadow-foreground/5 sm:p-6",
        className
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {eyebrow ? <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p> : null}
            {status}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-balance sm:text-4xl">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="section-header" className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p> : null}
        <h2 className="text-xl font-semibold tracking-normal text-balance">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StepProgress({
  steps,
  currentIndex,
  className,
}: {
  steps: Array<{ label: string; description?: string }>;
  currentIndex: number;
  className?: string;
}) {
  return (
    <ol data-slot="step-progress" className={cn("grid gap-2 sm:grid-cols-3", className)}>
      {steps.map((step, index) => {
        const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "pending";
        return (
          <li
            key={step.label}
            data-state={state}
            className={cn(
              "rounded-xl border bg-background/72 p-3 text-sm",
              state === "current" && "border-primary/35 bg-primary/[0.035]",
              state === "complete" && "border-emerald-200 bg-emerald-50/70"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full border text-xs font-semibold",
                  state === "current" && "border-primary bg-primary text-primary-foreground",
                  state === "complete" && "border-emerald-600 bg-emerald-600 text-white"
                )}
              >
                {index + 1}
              </span>
              <span className="font-medium">{step.label}</span>
            </div>
            {step.description ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{step.description}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function ActionCard({
  title,
  description,
  icon: Icon,
  badge,
  primary,
  disabledReason,
  footer,
  children,
  className,
  onClick,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: VisualIcon;
  badge?: ReactNode;
  primary?: boolean;
  disabledReason?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        {Icon ? (
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-background text-muted-foreground",
              primary && "border-primary bg-primary text-primary-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        {badge}
      </div>
      <div className="mt-5">
        <h3 className="font-semibold tracking-normal">{title}</h3>
        {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
      {disabledReason ? <p className="mt-auto pt-4 text-xs font-medium text-muted-foreground">{disabledReason}</p> : null}
      {footer ? <div className="mt-auto pt-4">{footer}</div> : null}
    </>
  );

  const classes = cn(
    "flex min-h-36 flex-col rounded-2xl border bg-card/88 p-4 text-left shadow-sm shadow-foreground/5 transition-all",
    primary && "border-primary/35 bg-primary/[0.035]",
    onClick && "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
    className
  );

  if (onClick) {
    return (
      <button type="button" data-slot="action-card" data-primary={primary ? "true" : undefined} className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <article data-slot="action-card" data-primary={primary ? "true" : undefined} className={classes}>
      {content}
    </article>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <article
      data-slot="metric-card"
      className={cn("rounded-2xl border bg-card/88 p-4 shadow-sm shadow-foreground/5", tone !== "neutral" && toneClasses[tone], className)}
    >
      <div className="flex min-h-24 items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
          {detail ? <div className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</div> : null}
        </div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </div>
    </article>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: VisualIcon | false;
  className?: string;
}) {
  const Icon = icon === false ? null : icon ?? toneIcons[tone];
  return (
    <span
      data-slot="status-pill"
      data-tone={tone}
      className={cn("inline-flex h-6 w-fit items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium", toneClasses[tone], className)}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

export function SourceBadge({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <StatusPill tone={muted ? "warning" : "info"} icon={false}>
      {children}
    </StatusPill>
  );
}

export function ConfidenceBadge({ level }: { level: string }) {
  const normalized = level.toLowerCase();
  const tone: Tone = normalized === "high" || normalized === "alta" ? "success" : normalized === "medium" || normalized === "média" || normalized === "media" ? "info" : "warning";
  const labelMap: Record<string, string> = {
    high: "Alta",
    medium: "Média",
    low: "Baixa",
    unverified: "Sem revisão",
  };

  return (
    <StatusPill tone={tone} icon={false}>
      {labelMap[normalized] ?? level}
    </StatusPill>
  );
}

export function AdvancedDisclosure({
  title,
  description,
  icon: Icon,
  badge,
  children,
  defaultOpen,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: VisualIcon;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details data-slot="advanced-disclosure" className={cn("group rounded-2xl border bg-card/88 shadow-sm shadow-foreground/5", className)} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary" /> : null}
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {badge}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
  );
}

export function InlineHelp({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const Icon = toneIcons[tone];
  return (
    <div data-slot="inline-help" className={cn("flex gap-2 rounded-xl border p-3 text-sm leading-6", toneClasses[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function FormSection({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card data-slot="form-section" className={cn("rounded-2xl shadow-sm shadow-foreground/5", className)}>
      <CardHeader className={action ? "grid-cols-[1fr_auto]" : undefined}>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="self-start justify-self-end">{action}</div> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export function BudgetGroupCard({
  title,
  description,
  status,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card data-slot="budget-group-card" className={cn("rounded-2xl shadow-sm shadow-foreground/5", className)}>
      <CardHeader className={status ? "grid-cols-[1fr_auto]" : undefined}>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {status ? <div className="self-start justify-self-end">{status}</div> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export function StickySummary({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside data-slot="sticky-summary" className={cn("h-fit rounded-2xl border bg-card/90 p-5 shadow-sm shadow-foreground/5 xl:sticky xl:top-6", className)}>
      <h2 className="font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      <div className="mt-4 space-y-3 text-sm">{children}</div>
    </aside>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Info,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: VisualIcon;
  className?: string;
}) {
  return (
    <div data-slot="empty-state" className={cn("rounded-xl border border-dashed bg-background/60 p-4 text-sm", className)}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">{title}</p>
          {description ? <p className="mt-1 leading-6 text-muted-foreground">{description}</p> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function PendingState({
  title,
  description,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="pending-state"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn("grid min-h-[220px] place-items-center rounded-2xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground", className)}
    >
      <div>
        <Clock3 className="mx-auto h-5 w-5" />
        <p className="mt-3 font-medium text-foreground">{title}</p>
        {description ? <p className="mt-1 leading-6">{description}</p> : null}
      </div>
    </div>
  );
}

export function FileDropzone({
  title,
  description,
  actionLabel,
  onClick,
  disabled,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actionLabel?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-slot="file-dropzone"
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-center justify-center rounded-2xl border border-dashed bg-background/70 p-5 text-center transition hover:border-primary/35 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-55",
        className
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl border bg-card text-muted-foreground">
        <FileUp className="h-5 w-5" />
      </span>
      <span className="mt-3 font-medium">{title}</span>
      {description ? <span className="mt-1 text-sm leading-6 text-muted-foreground">{description}</span> : null}
      {actionLabel ? <span className="mt-3 text-sm font-medium text-primary">{actionLabel}</span> : null}
    </button>
  );
}
