import type { AppWarning } from "@/types/project";
import type { EcoBlockInputs } from "./types";

export const ecoBlockBaseWarnings: AppWarning[] = [
  {
    id: "eco-block-no-structural-assumption",
    level: "warning",
    message: "Nao assumir funcao estrutural automaticamente; vedacao e estrutura exigem definicoes tecnicas diferentes.",
  },
  {
    id: "eco-block-structural-validation",
    level: "warning",
    message: "Uso estrutural depende de calculo, sistema validado, fornecedor, detalhes executivos e ART/RRT.",
  },
  {
    id: "eco-block-modulation",
    level: "warning",
    message: "Compatibilizar modulacao dos blocos com planta, aberturas, fiadas, vergas, contravergas e instalacoes.",
  },
  {
    id: "eco-block-waterproof-base",
    level: "warning",
    message: "Prever impermeabilizacao da primeira fiada e detalhes contra umidade ascendente.",
  },
  {
    id: "eco-block-services",
    level: "warning",
    message: "Prever passagens eletricas e hidraulicas antes da elevacao das paredes.",
  },
  {
    id: "eco-block-preliminary-quantities",
    level: "warning",
    message: "Quantitativos e orcamento sao preliminares e devem ser revisados com projeto executivo.",
  },
];

export function calculateEcoBlockWarnings(inputs?: EcoBlockInputs): AppWarning[] {
  const warnings = [...ecoBlockBaseWarnings];

  if (inputs?.useType === "structural-preliminary") {
    warnings.unshift({
      id: "eco-block-structural-mode-selected",
      level: "error",
      message: "Modo estrutural preliminar selecionado: exigir calculo e sistema validado antes de qualquer decisao executiva.",
    });
  }

  return warnings;
}
