"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Box, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();
  const hideHeader = pathname === "/";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideHeader ? (
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Box className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">Construção Estudo</span>
                <span className="block text-xs text-muted-foreground">pré-projeto modular</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-2 md:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/feedback">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Melhorias
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/privacy">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Privacidade
                </Link>
              </Button>
            </nav>
            <div className="flex items-center gap-2">
              {!isLoaded ? (
                <div className="h-7 w-36" aria-hidden="true" />
              ) : isSignedIn ? (
                <>
                  <Button asChild size="sm">
                    <Link href="/dashboard">Abrir app</Link>
                  </Button>
                  <UserButton />
                </>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/sign-in">Entrar</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/sign-up">Criar conta</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>
      ) : null}
      {children}
    </div>
  );
}
