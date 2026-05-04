"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  BarChart3,
  Box,
  Building2,
  Calculator,
  ClipboardList,
  FileDown,
  FileText,
  HelpCircle,
  Home,
  Menu,
  MessageSquare,
  Package,
  PenLine,
  PlusCircle,
  Ruler,
  Settings,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { getConstructionMethodDefinition, type ConstructionMethodId } from "@/lib/construction-methods";
import { isAppNavigationItemVisible } from "@/lib/navigation/app-navigation";
import { useProjectStore } from "@/lib/store/project-store";
import { canUseAppShellBeforeOnboarding } from "@/lib/routes/shell";
import { cn } from "@/lib/utils";

const navSections = [
  {
    title: "Projeto",
    items: [
      { href: "/dashboard", label: "Painel", icon: Home },
      { href: "/start", label: "Novo estudo", icon: PlusCircle },
      { href: "/edit", label: "Dados do metodo", icon: PenLine },
      { href: "/model-3d", label: "Visual 3D", icon: Box },
      { href: "/technical-project", label: "Projeto tecnico", icon: FileText },
    ],
  },
  {
    title: "Tecnico",
    items: [
      { href: "/materials", label: "Materiais", icon: Package },
      { href: "/structure", label: "Estrutura A-frame", icon: Building2, badge: "A-frame" },
      { href: "/scenarios", label: "Cenarios", icon: BarChart3 },
      { href: "/settings", label: "Premissas tecnicas", icon: Settings },
    ],
  },
  {
    title: "Orcamento",
    items: [
      { href: "/budget", label: "Orcamento preliminar", icon: Calculator },
      { href: "/budget-assistant", label: "Assistente de orcamento", icon: WalletCards },
      { href: "/quotation", label: "Cotacao", icon: ClipboardList },
      { href: "/export", label: "Exportacoes", icon: FileDown },
    ],
  },
  {
    title: "Suporte",
    items: [
      { href: "/feedback", label: "Melhorias", icon: MessageSquare },
      { href: "/admin/feedback", label: "Admin melhorias", icon: ShieldCheck },
      { href: "/help", label: "Ajuda", icon: HelpCircle },
    ],
  },
];

function NavList({ constructionMethod, onNavigate }: { constructionMethod?: ConstructionMethodId; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-5">
      {navSections.map((section) => {
        const visibleItems = section.items.filter((item) => isAppNavigationItemVisible(item.href, constructionMethod));
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title} className="grid gap-1.5">
            <p className="px-3 text-[0.68rem] font-semibold uppercase text-muted-foreground">{section.title}</p>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (pathname === "/" && item.href === "/dashboard");
              return (
                <Link
                  href={item.href}
                  key={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground",
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
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const project = useProjectStore((state) => state.project);
  const onboardingCompleted = project.onboardingCompleted;
  const selectedScenario = project.scenarios.find((scenario) => scenario.id === project.selectedScenarioId) ?? project.scenarios[0];
  const constructionMethod = selectedScenario?.constructionMethod;
  const methodName = constructionMethod ? getConstructionMethodDefinition(constructionMethod).name : "Metodo a definir";

  useEffect(() => {
    if (!onboardingCompleted && !canUseAppShellBeforeOnboarding(pathname)) {
      router.replace("/start");
    }
  }, [onboardingCompleted, pathname, router]);

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
              <p className="text-xs text-muted-foreground">pre-projeto modular</p>
            </div>
          </Link>
          <UserButton />
        </div>
        <div className="mx-2 mt-5 rounded-lg border bg-background/60 p-3">
          <p className="text-[0.68rem] font-semibold uppercase text-muted-foreground">Metodo ativo</p>
          <p className="mt-1 text-sm font-medium">{methodName}</p>
        </div>
        <Separator className="my-5" />
        <NavList constructionMethod={constructionMethod} />
      </aside>
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="font-semibold">
            Estudo Construtivo
          </Link>
          <div className="flex items-center gap-2">
            <UserButton />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir navegacao">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>Estudo Construtivo</SheetTitle>
                </SheetHeader>
                <div className="mt-5 rounded-lg border bg-background/60 p-3">
                  <p className="text-[0.68rem] font-semibold uppercase text-muted-foreground">Metodo ativo</p>
                  <p className="mt-1 text-sm font-medium">{methodName}</p>
                </div>
                <div className="mt-6">
                  <NavList constructionMethod={constructionMethod} />
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
