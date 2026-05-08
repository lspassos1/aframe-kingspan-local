"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  BarChart3,
  Box,
  Building2,
  Calculator,
  ChevronDown,
  ClipboardList,
  FileDown,
  FileText,
  HelpCircle,
  Home,
  Loader2,
  Menu,
  MessageSquare,
  Package,
  PenLine,
  Ruler,
  Settings,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { getConstructionMethodDefinition, type ConstructionMethodId } from "@/lib/construction-methods";
import { getVisibleAppNavigationSections, type AppNavigationItem, type AppNavigationSection } from "@/lib/navigation/app-navigation";
import { useProjectStore } from "@/lib/store/project-store";
import { buildStartRedirectUrl, getAppShellProjectGuardState, type AppShellProjectGuardState } from "@/lib/routes/shell";
import { cn } from "@/lib/utils";

const navigationIcons: Record<string, ComponentType<{ className?: string }>> = {
  "/dashboard": Home,
  "/edit": PenLine,
  "/budget": Calculator,
  "/model-3d": Box,
  "/export": FileDown,
  "/materials": Package,
  "/technical-project": FileText,
  "/structure": Building2,
  "/settings": Settings,
  "/budget-assistant": WalletCards,
  "/quotation": ClipboardList,
  "/scenarios": BarChart3,
  "/help": HelpCircle,
  "/feedback": MessageSquare,
  "/admin/feedback": ShieldCheck,
};

function NavLink({
  item,
  active,
  compact = false,
  onNavigate,
}: {
  item: AppNavigationItem;
  active: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = navigationIcons[item.href] ?? Home;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground",
        compact ? "py-2" : "py-2.5",
        active && "bg-primary text-primary-foreground shadow-sm shadow-primary/15 hover:bg-primary hover:text-primary-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className={cn("rounded-full border px-1.5 py-0.5 text-[0.62rem]", active ? "border-primary-foreground/30" : "border-border text-muted-foreground")}>
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function isNavigationItemActive(pathname: string, item: AppNavigationItem) {
  return pathname === item.href || (pathname === "/" && item.href === "/dashboard");
}

function NavigationSectionList({
  section,
  currentPathname,
  onNavigate,
}: {
  section: AppNavigationSection;
  currentPathname: string;
  onNavigate?: () => void;
}) {
  const hasActiveItem = section.items.some((item) => isNavigationItemActive(currentPathname, item));
  const [isOpen, setIsOpen] = useState(hasActiveItem);
  const detailsOpen = isOpen || hasActiveItem;

  if (section.items.length === 0) return null;

  if (section.collapsible) {
    return (
      <details className="group rounded-lg border bg-background/45" onToggle={(event) => setIsOpen(event.currentTarget.open)} open={detailsOpen}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span>{section.title}</span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-1 px-1 pb-2">
          {section.items.map((item) => (
            <NavLink item={item} active={isNavigationItemActive(currentPathname, item)} compact key={item.href} onNavigate={onNavigate} />
          ))}
        </div>
      </details>
    );
  }

  return (
    <div className="grid gap-1.5">
      {section.items.map((item) => (
        <NavLink item={item} active={isNavigationItemActive(currentPathname, item)} key={item.href} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function NavList({
  constructionMethod,
  isAdmin,
  onNavigate,
}: {
  constructionMethod?: ConstructionMethodId;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = getVisibleAppNavigationSections(constructionMethod, isAdmin);
  const primarySection = sections.find((section) => section.id === "primary");
  const advancedSection = sections.find((section) => section.id === "advanced");
  const utilitySection = sections.find((section) => section.id === "utility");

  return (
    <nav className="grid gap-4">
      {primarySection ? <NavigationSectionList currentPathname={pathname} section={primarySection} onNavigate={onNavigate} /> : null}
      {advancedSection ? <NavigationSectionList currentPathname={pathname} section={advancedSection} onNavigate={onNavigate} /> : null}
      {utilitySection && utilitySection.items.length > 0 ? (
        <div className="grid gap-1 border-t pt-3">
          {utilitySection.items.map((item) => (
            <NavLink item={item} active={isNavigationItemActive(pathname, item)} compact key={item.href} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
    </nav>
  );
}

function ProjectRouteState({ state, pathname }: { state: Exclude<AppShellProjectGuardState, "ready">; pathname: string }) {
  const copy =
    state === "hydrating"
      ? {
          title: "Carregando estudo",
          description: "Estamos recuperando o estudo salvo neste navegador antes de abrir a rota interna.",
          badge: "Hidratação do projeto",
          action: null,
        }
      : state === "invalid-project"
        ? {
            title: "Não foi possível carregar o estudo",
            description: "Os dados locais parecem inválidos. Comece um novo estudo ou importe um JSON salvo.",
            badge: "Projeto inválido",
            action: buildStartRedirectUrl(pathname, "project-invalid"),
          }
        : {
            title: "Nenhum estudo carregado",
            description: "Para abrir esta rota, comece pela planta, preencha os dados ou carregue o exemplo.",
            badge: "Projeto ausente",
            action: buildStartRedirectUrl(pathname, "project-required"),
          };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-xl rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            {state === "hydrating" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Ruler className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{copy.badge}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{copy.title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.description}</p>
            <p className="mt-4 rounded-2xl border bg-background/70 px-3 py-2 text-xs text-muted-foreground">Rota solicitada: {pathname}</p>
            {copy.action ? (
              <Button asChild className="mt-5">
                <Link href={copy.action}>Ir para o início</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const project = useProjectStore((state) => state.project);
  const projectHydrationStatus = useProjectStore((state) => state.projectHydrationStatus);
  const onboardingCompleted = project.onboardingCompleted;
  const selectedScenario = project.scenarios.find((scenario) => scenario.id === project.selectedScenarioId) ?? project.scenarios[0];
  const constructionMethod = selectedScenario?.constructionMethod;
  const methodName = constructionMethod ? getConstructionMethodDefinition(constructionMethod).name : "Método a definir";
  const projectGuardState = getAppShellProjectGuardState({ pathname, projectHydrationStatus, onboardingCompleted });

  useEffect(() => {
    if (projectGuardState === "missing-project") {
      router.replace(buildStartRedirectUrl(pathname, "project-required"));
    }
    if (projectGuardState === "invalid-project") {
      router.replace(buildStartRedirectUrl(pathname, "project-invalid"));
    }
  }, [pathname, projectGuardState, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminStatus() {
      try {
        const response = await fetch("/api/admin/status", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { isAdmin?: unknown };
        if (!cancelled) setIsAdmin(data.isAdmin === true);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    }

    loadAdminStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  if (projectGuardState !== "ready") {
    return <ProjectRouteState pathname={pathname} state={projectGuardState} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-sidebar/92 px-4 py-5 shadow-sm backdrop-blur-xl lg:block">
        <div className="flex items-center justify-between gap-3 px-2">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/15">
              <Ruler className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Estudo Construtivo</p>
              <p className="text-xs text-muted-foreground">pré-orçamento modular</p>
            </div>
          </Link>
          <UserButton />
        </div>
        <div className="mx-2 mt-5 rounded-lg border bg-background/60 p-3">
          <p className="text-[0.68rem] font-semibold uppercase text-muted-foreground">Método ativo</p>
          <p className="mt-1 text-sm font-medium">{methodName}</p>
        </div>
        <Separator className="my-5" />
        <NavList constructionMethod={constructionMethod} isAdmin={isAdmin} />
      </aside>
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="font-semibold">
            Estudo Construtivo
          </Link>
          <div className="flex items-center gap-2">
            <UserButton />
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir navegação">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>Estudo Construtivo</SheetTitle>
                  <SheetDescription>Navegue pelo estudo, opções avançadas e suporte.</SheetDescription>
                </SheetHeader>
                <div className="mt-5 rounded-lg border bg-background/60 p-3">
                  <p className="text-[0.68rem] font-semibold uppercase text-muted-foreground">Método ativo</p>
                  <p className="mt-1 text-sm font-medium">{methodName}</p>
                </div>
                <div className="mt-6">
                  <NavList constructionMethod={constructionMethod} isAdmin={isAdmin} onNavigate={() => setIsSheetOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="lg:pl-72">
        <div className="mx-auto flex min-h-screen max-w-[1540px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
