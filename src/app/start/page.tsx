import { StartProjectForm } from "@/components/onboarding/StartProjectForm";
import { PlanImportCard } from "@/components/ai/PlanImportCard";
import { isAiPlanExtractEnabled } from "@/lib/ai/plan-extract-request";
import { ArrowDown, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StartPage() {
  const planExtractEnabled = isAiPlanExtractEnabled();

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border bg-card/85 p-6 shadow-sm shadow-foreground/5 sm:p-8">
        <div className="relative max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">Novo estudo</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-balance sm:text-5xl">Comece pelo método, avance com dados claros.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Escolha o sistema construtivo, informe lote e dimensões principais, e siga para o 3D ou para o orçamento preliminar.
          </p>
        </div>
        <div className="relative mt-8 grid gap-3 md:grid-cols-2">
          <a
            href="#manual-start"
            className="group rounded-2xl border bg-background/80 p-4 shadow-sm shadow-foreground/5 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <PenLine className="h-5 w-5" />
            </span>
            <span className="mt-4 block font-semibold">Preencher manualmente</span>
            <span className="mt-1 block text-sm text-muted-foreground">Controle total dos campos do estudo.</span>
          </a>
          {planExtractEnabled ? <PlanImportCard /> : null}
        </div>
        <Button asChild variant="outline" className="relative mt-6">
          <a href="#manual-start">
            Ir para dados do projeto
            <ArrowDown className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </section>
      <div id="manual-start" className="scroll-mt-6">
        <StartProjectForm />
      </div>
    </div>
  );
}
