import type { AppWarning } from "@/types/project";

export const conventionalMasonryWarnings: AppWarning[] = [
  {
    id: "masonry-structural-project-required",
    level: "warning",
    message: "Calculo estrutural de pilares, vigas, lajes e fundacoes nao e substituido por esta estimativa.",
  },
  {
    id: "masonry-concrete-steel-preliminary",
    level: "warning",
    message: "Concreto, aco e formas entram como placeholders preliminares ate existir projeto estrutural.",
  },
  {
    id: "masonry-large-spans-engineer",
    level: "warning",
    message: "Grandes vaos, balancos, pavimentos adicionais e cargas especiais exigem engenheiro habilitado.",
  },
  {
    id: "masonry-executive-project-required",
    level: "warning",
    message: "Quantitativos dependem de planta executiva, paginacao de paredes, aberturas e compatibilizacao de instalacoes.",
  },
  {
    id: "masonry-preliminary-budget",
    level: "warning",
    message: "Orcamento preliminar: substituir placeholders por composicoes, SINAPI ou cotacoes formais antes de decisao de obra.",
  },
];

export function calculateConventionalMasonryWarnings(): AppWarning[] {
  return conventionalMasonryWarnings;
}
