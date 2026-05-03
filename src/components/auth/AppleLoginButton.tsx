import { Apple } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppleLoginButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      disabled
      aria-label="Continuar com Apple indisponivel"
      title="Apple login exibido apenas como opcao visual"
      className="w-full max-w-[400px] border-neutral-300 bg-neutral-950 text-white opacity-100 disabled:opacity-100"
    >
      <Apple className="h-4 w-4" />
      Continuar com Apple
    </Button>
  );
}
