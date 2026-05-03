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
  Wrench,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { MandatoryWarning } from "@/components/shared/MandatoryWarning";
import { useProjectStore } from "@/lib/store/project-store";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/start", label: "Novo projeto", icon: PlusCircle },
  { href: "/edit", label: "Configurar", icon: PenLine },
  { href: "/model-3d", label: "Modelo 3D", icon: Box },
  { href: "/technical-project", label: "Projeto Tecnico", icon: FileText },
  { href: "/materials", label: "Materiais", icon: Package },
  { href: "/structure", label: "Estrutura Metalica", icon: Building2 },
  { href: "/budget", label: "Orcamento", icon: Calculator },
  { href: "/quotation", label: "Cotacao", icon: ClipboardList },
  { href: "/scenarios", label: "Cenarios", icon: BarChart3 },
  { href: "/export", label: "Exportar", icon: FileDown },
  { href: "/feedback", label: "Melhorias", icon: MessageSquare },
  { href: "/admin/feedback", label: "Admin melhorias", icon: ShieldCheck },
  { href: "/settings", label: "Premissas", icon: Settings },
  { href: "/help", label: "Ajuda", icon: HelpCircle },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (pathname === "/" && item.href === "/dashboard");
        return (
          <Link
            href={item.href}
            key={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const onboardingCompleted = useProjectStore((state) => state.project.onboardingCompleted);

  useEffect(() => {
    if (!onboardingCompleted && pathname !== "/start") {
      router.replace("/start");
    }
  }, [onboardingCompleted, pathname, router]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-sidebar/95 px-4 py-5 shadow-sm lg:block">
        <div className="flex items-center justify-between gap-3 px-2">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <Ruler className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">A-frame Estudo</p>
              <p className="text-xs text-muted-foreground">pre-projeto seguro</p>
            </div>
          </Link>
          <UserButton />
        </div>
        <Separator className="my-5" />
        <NavList />
        <div className="absolute bottom-5 left-4 right-4 rounded-md border bg-card/80 p-3 text-xs text-muted-foreground shadow-sm">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <Wrench className="h-3.5 w-3.5" />
            Uso pessoal/local
          </div>
          Login seguro via Clerk, sem banco proprio de usuarios e sem precos inventados.
          <br />
          Projetos continuam salvos no navegador.
        </div>
      </aside>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="font-semibold">
            A-frame Estudo
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
                  <SheetTitle>Navegacao</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <NavList />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="lg:pl-72">
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
          <MandatoryWarning />
          {children}
        </div>
      </main>
    </div>
  );
}
