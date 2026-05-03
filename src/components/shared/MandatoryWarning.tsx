"use client";

import { useSyncExternalStore } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const GENERAL_WARNING =
  "Estimativa preliminar para estudo de viabilidade. Esta ferramenta nao substitui projeto estrutural, projeto arquitetonico, ART/RRT, aprovacao municipal, sondagem de solo, calculo de fundacoes, verificacao de vento, nem validacao tecnica do fornecedor dos paineis.";

export const STRUCTURAL_WARNING =
  "Pre-dimensionamento estrutural. O dimensionamento final deve ser feito por engenheiro habilitado, considerando normas brasileiras aplicaveis, cargas reais, vento local, conexoes, fundacoes e execucao.";

const generalWarningStorageKey = "aframe-general-warning-read";
const structuralWarningStorageKey = "aframe-structural-warning-read";
const localStorageChangeEvent = "aframe-local-storage-change";

function subscribeToLocalStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(localStorageChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(localStorageChangeEvent, callback);
  };
}

function hasReadWarning(storageKey: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(storageKey) === "true";
}

export function MandatoryWarning({ structural = false }: { structural?: boolean }) {
  const storageKey = structural ? structuralWarningStorageKey : generalWarningStorageKey;
  const dismissed = useSyncExternalStore(
    subscribeToLocalStorage,
    () => hasReadWarning(storageKey),
    () => false
  );

  const dismiss = () => {
    window.localStorage.setItem(storageKey, "true");
    window.dispatchEvent(new Event(localStorageChangeEvent));
  };

  if (dismissed) return null;

  return (
    <Alert className="border-amber-300 bg-amber-50 pr-12 text-amber-950">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{structural ? "Aviso estrutural obrigatorio" : "Aviso obrigatorio"}</AlertTitle>
      <AlertDescription>{structural ? STRUCTURAL_WARNING : GENERAL_WARNING}</AlertDescription>
      <AlertAction>
        <Button variant="ghost" size="icon-xs" onClick={dismiss} aria-label="Ocultar aviso lido">
          <X className="h-3.5 w-3.5" />
        </Button>
      </AlertAction>
    </Alert>
  );
}
