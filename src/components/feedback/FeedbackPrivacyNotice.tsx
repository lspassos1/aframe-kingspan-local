"use client";

import { useSyncExternalStore } from "react";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const storageKey = "aframe-feedback-privacy-notice-read";
const localStorageChangeEvent = "aframe-local-storage-change";

function subscribeToLocalStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(localStorageChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(localStorageChangeEvent, callback);
  };
}

function hasReadNotice() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(storageKey) === "true";
}

export function FeedbackPrivacyNotice() {
  const dismissed = useSyncExternalStore(subscribeToLocalStorage, hasReadNotice, () => false);

  const dismiss = () => {
    window.localStorage.setItem(storageKey, "true");
    window.dispatchEvent(new Event(localStorageChangeEvent));
  };

  if (dismissed) return null;

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Dados minimos
        </CardTitle>
        <Button variant="ghost" size="icon-xs" onClick={dismiss} aria-label="Ocultar aviso lido">
          <X className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>Contato e opcional e serve apenas para retorno sobre a sugestao.</p>
        <p>Projetos, medidas e orcamentos ficam salvos neste navegador.</p>
      </CardContent>
    </Card>
  );
}
