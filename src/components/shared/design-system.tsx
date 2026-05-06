import type { ComponentType, ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Clock3, FileUp, Info, MessageSquareText, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type VisualIcon = ComponentType<{ className?: string }>;
type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "pending";

const toneClasses: Record<Tone, string> = {
  neutral: "border-border/80 bg-background/80 text-foreground",
  info: "border-cyan-200 bg-cyan-50 text-cyan-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-destructive/30 bg-destructive/5 text-destructive",
  pending: "border-indigo-200 bg-indigo-50 text-indigo-950",
};

const panelSurface =
  "border border-border/75 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--background))_100%)] shadow-sm shadow-slate-950/[0.035]";

const interactiveSurface =
  "transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-slate-950/[0.06] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35";

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
        "relative overflow-hidden rounded-3xl p-5 sm:p-6",
        panelSurface,
        "before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--ring)),hsl(var(--chart-2)))]",
        className
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p> : null}
            {status}
          </div>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-normal text-balance sm:text-4xl">{title}</h1>
          {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
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
    <div data-slot="section-header" className={cn("flex flex-col gap-3 border-l-2 border-primary/30 pl-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p> : null}
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
              "relative overflow-hidden rounded-2xl border bg-background/78 p-3 text-sm",
              state === "current" && "border-primary/35 bg-primary/[0.04] shadow-sm shadow-primary/10",
              state === "complete" && "border-emerald-200 bg-emerald-50/80",
              state === "pending" && "text-muted-foreground"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-0 top-0 h-0.5 bg-border",
                state === "current" && "bg-primary",
                state === "complete" && "bg-emerald-600"
              )}
            />
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
              "grid h-11 w-11 shrink-0 place-items-center rounded-2xl border bg-background text-muted-foreground shadow-inner shadow-foreground/[0.02]",
              primary && "border-primary bg-primary text-primary-foreground shadow-none"
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        {badge}
      </div>
      <div className="mt-5">
        <h3 className="text-lg font-semibold tracking-normal">{title}</h3>
        {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
      {disabledReason ? <p className="mt-auto pt-4 text-xs font-medium text-muted-foreground">{disabledReason}</p> : null}
      {footer ? <div className="mt-auto pt-4">{footer}</div> : null}
    </>
  );

  const classes = cn(
    "flex min-h-36 flex-col rounded-3xl p-4 text-left",
    panelSurface,
    primary && "border-primary/35 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--accent)))]",
    onClick && interactiveSurface,
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
      className={cn("relative overflow-hidden rounded-3xl p-4", panelSurface, tone !== "neutral" && toneClasses[tone], className)}
    >
      <span aria-hidden="true" className={cn("absolute inset-y-4 left-0 w-1 rounded-r-full bg-border", tone !== "neutral" && "bg-current/40")} />
      <div className="flex min-h-24 items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
          {detail ? <div className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</div> : null}
        </div>
        {icon ? <div className="grid h-9 w-9 place-items-center rounded-2xl border bg-background/80 text-muted-foreground">{icon}</div> : null}
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
      className={cn("inline-flex h-6 w-fit items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold", toneClasses[tone], className)}
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
    <details data-slot="advanced-disclosure" className={cn("group rounded-3xl", panelSurface, className)} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary" /> : null}
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {badge}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t bg-background/42 p-4">{children}</div>
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
    <div data-slot="inline-help" className={cn("flex gap-2 rounded-2xl border p-3 text-sm leading-6", toneClasses[tone], className)}>
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
    <section data-slot="form-section" className={cn("overflow-hidden rounded-3xl", panelSurface, className)}>
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold tracking-normal">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="self-start">{action}</div> : null}
      </div>
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
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
    <section data-slot="budget-group-card" className={cn("overflow-hidden rounded-3xl", panelSurface, className)}>
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold tracking-normal">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {status ? <div className="self-start">{status}</div> : null}
      </div>
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}

export function ReviewCard({
  title,
  description,
  status,
  selected,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  selected?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      data-slot="review-card"
      data-selected={selected ? "true" : undefined}
      className={cn("rounded-2xl border bg-card/88 p-4 shadow-sm shadow-foreground/5", selected && "border-primary/35 bg-primary/[0.035]", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold tracking-normal">{title}</h3>
          {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

export function EvidenceCard({
  title = "Evidência",
  evidence,
  source,
  pending,
  className,
}: {
  title?: ReactNode;
  evidence?: ReactNode;
  source?: ReactNode;
  pending?: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="evidence-card" className={cn("rounded-xl border bg-muted/25 p-3 text-sm leading-6", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">{title}</p>
        {source ? <SourceBadge>{source}</SourceBadge> : null}
      </div>
      {evidence ? <p className="mt-1 text-muted-foreground">{evidence}</p> : null}
      {pending ? <p className="mt-2 text-amber-800">{pending}</p> : null}
    </div>
  );
}

export function QuestionCard({
  question,
  reason,
  required,
  children,
  className,
}: {
  question: ReactNode;
  reason?: ReactNode;
  required?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <article data-slot="question-card" className={cn("rounded-2xl border border-amber-200 bg-amber-50/75 p-4 text-amber-950", className)}>
      <div className="flex items-start gap-3">
        <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold tracking-normal">{question}</h3>
            {required ? (
              <StatusPill tone="warning" icon={false}>
                antes do orçamento
              </StatusPill>
            ) : null}
          </div>
          {reason ? <p className="mt-1 text-sm leading-6 text-amber-900/85">{reason}</p> : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </article>
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
    <aside data-slot="sticky-summary" className={cn("h-fit rounded-3xl p-5 xl:sticky xl:top-6", panelSurface, className)}>
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
    <div data-slot="empty-state" className={cn("rounded-2xl border border-dashed bg-background/70 p-4 text-sm", className)}>
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
      className={cn("grid min-h-[220px] place-items-center rounded-3xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground", className)}
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
        "flex w-full flex-col items-center justify-center rounded-3xl border border-dashed bg-background/70 p-6 text-center",
        interactiveSurface,
        "disabled:pointer-events-none disabled:opacity-55",
        className
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl border bg-card text-muted-foreground shadow-inner shadow-foreground/[0.02]">
        <FileUp className="h-5 w-5" />
      </span>
      <span className="mt-3 font-medium">{title}</span>
      {description ? <span className="mt-1 text-sm leading-6 text-muted-foreground">{description}</span> : null}
      {actionLabel ? <span className="mt-3 text-sm font-medium text-primary">{actionLabel}</span> : null}
    </button>
  );
}
