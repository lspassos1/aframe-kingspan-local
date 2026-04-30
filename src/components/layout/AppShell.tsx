"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Package,
  PenLine,
  Ruler,
  Settings,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { MandatoryWarning } from "@/components/shared/MandatoryWarning";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/edit", label: "Configurar", icon: PenLine },
  { href: "/model-3d", label: "Modelo 3D", icon: Box },
  { href: "/technical-project", label: "Projeto Tecnico", icon: FileText },
  { href: "/materials", label: "Materiais", icon: Package },
  { href: "/structure", label: "Estrutura Metalica", icon: Building2 },
  { href: "/budget", label: "Orcamento", icon: Calculator },
  { href: "/quotation", label: "Cotacao", icon: ClipboardList },
  { href: "/scenarios", label: "Cenarios", icon: BarChart3 },
  { href: "/export", label: "Exportar", icon: FileDown },
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
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-sidebar px-4 py-5 lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Ruler className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">A-frame MVP</p>
            <p className="text-xs text-muted-foreground">Pre-projeto local</p>
          </div>
        </Link>
        <Separator className="my-5" />
        <NavList />
        <div className="absolute bottom-5 left-4 right-4 rounded-md border bg-background p-3 text-xs text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <Wrench className="h-3.5 w-3.5" />
            Uso pessoal/local
          </div>
          Sem login, sem backend obrigatorio e sem precos inventados.
        </div>
      </aside>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="font-semibold">
            A-frame MVP
          </Link>
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
