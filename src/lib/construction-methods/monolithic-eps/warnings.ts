import type { AppWarning } from "@/types/project";
import type { MonolithicEpsInputs } from "./types";

export const monolithicEpsBaseWarnings: AppWarning[] = [
  {
    id: "eps-system-validation",
    level: "warning",
    message: "Sistema EPS monolitico precisa de fornecedor, documentacao tecnica, validacao de desempenho e ART/RRT.",
  },
  {
    id: "eps-no-structural-assumption",
    level: "warning",
    message: "Nao assumir desempenho estrutural sem dados do fabricante, sistema validado e calculo de responsavel tecnico.",
  },
  {
    id: "eps-specialized-labor",
    level: "warning",
    message: "Mao de obra, escoramento, alinhamento, telas/reforcos e projeção/revestimento exigem equipe especializada.",
  },
  {
    id: "eps-services-before-render",
    level: "warning",
    message: "Compatibilizar instalacoes eletricas/hidraulicas antes da projeção de argamassa/concreto.",
  },
  {
    id: "eps-preliminary-budget",
    level: "warning",
    message: "Orcamento preliminar; substituir placeholders por cotacao formal do sistema e composicoes revisadas.",
  },
];

export function calculateMonolithicEpsWarnings(inputs?: MonolithicEpsInputs): AppWarning[] {
  const warnings = [...monolithicEpsBaseWarnings];

  if (inputs?.useType === "structural-preliminary") {
    warnings.unshift({
      id: "eps-structural-mode-selected",
      level: "error",
      message: "Modo estrutural preliminar selecionado: exige sistema homologado, fabricante, calculo e responsavel tecnico.",
    });
  }

  return warnings;
}
