"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingAuthActions() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <div className="h-9" aria-hidden="true" />;
  }

  if (isSignedIn) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/dashboard">
            Abrir app
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button asChild size="lg">
        <Link href="/sign-up">
          Criar conta e iniciar
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" size="lg">
        <Link href="/sign-in">Entrar</Link>
      </Button>
    </div>
  );
}
