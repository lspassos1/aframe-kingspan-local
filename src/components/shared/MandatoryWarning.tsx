import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const GENERAL_WARNING =
  "Estimativa preliminar para estudo de viabilidade. Esta ferramenta nao substitui projeto estrutural, projeto arquitetonico, ART/RRT, aprovacao municipal, sondagem de solo, calculo de fundacoes, verificacao de vento, nem validacao tecnica do fornecedor dos paineis.";

export const STRUCTURAL_WARNING =
  "Pre-dimensionamento estrutural. O dimensionamento final deve ser feito por engenheiro habilitado, considerando normas brasileiras aplicaveis, cargas reais, vento local, conexoes, fundacoes e execucao.";

export function MandatoryWarning({ structural = false }: { structural?: boolean }) {
  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-950">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{structural ? "Aviso estrutural obrigatorio" : "Aviso obrigatorio"}</AlertTitle>
      <AlertDescription>{structural ? STRUCTURAL_WARNING : GENERAL_WARNING}</AlertDescription>
    </Alert>
  );
}
