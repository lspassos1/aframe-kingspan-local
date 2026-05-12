export type GuidedActionTone = "info" | "success" | "warning" | "pending";

export type GuidedActionKind = "ai" | "central-db" | "export" | "manual-price" | "price-base" | "region" | "review";

export interface GuidedActionLink {
  label: string;
  href: string;
  variant?: "default" | "outline" | "secondary";
}

export interface GuidedActionItem {
  id: string;
  kind: GuidedActionKind;
  title: string;
  description: string;
  status: string;
  tone: GuidedActionTone;
  actions: GuidedActionLink[];
}

export interface BudgetAssistantGuidanceInput {
  hasValidRegion: boolean;
  costSourceCount: number;
  applicableCostSourceCount: number;
  pendingPriceCount: number;
  lowConfidenceCount: number;
  remotePriceDbConfigured?: boolean;
}

export interface ExportGuidanceInput {
  pendingMaterialCount: number;
  pendingBudgetItemCount: number;
  warningCount: number;
}

export function createBudgetAssistantGuidance(input: BudgetAssistantGuidanceInput): GuidedActionItem[] {
  const items: GuidedActionItem[] = [];

  if (!input.hasValidRegion) {
    items.push({
      id: "region-required",
      kind: "region",
      title: "Região pendente",
      description: "Defina cidade e UF antes de filtrar fontes ou aprovar preços regionais.",
      status: "ação",
      tone: "warning",
      actions: [{ label: "Revisar dados da obra", href: "/edit" }],
    });
  }

  if (!input.remotePriceDbConfigured) {
    items.push({
      id: "central-db-unavailable",
      kind: "central-db",
      title: "Base central indisponível",
      description: "Use uma base importada ou uma fonte manual revisável até a busca central entrar no fluxo.",
      status: "usar base local",
      tone: "pending",
      actions: [
        { label: "Importar base de preços", href: "#price-base-import" },
        { label: "Cadastrar fonte", href: "#manual-price-source", variant: "outline" },
      ],
    });
  }

  if (input.costSourceCount === 0) {
    items.push({
      id: "no-price-base",
      kind: "price-base",
      title: "Nenhuma base de preço",
      description: "Importe SINAPI/CSV/XLSX/JSON/ZIP ou cadastre uma fonte local antes de vincular preços.",
      status: "pendente",
      tone: "warning",
      actions: [
        { label: "Importar base de preços", href: "#price-base-import" },
        { label: "Cadastrar fonte", href: "#manual-price-source", variant: "outline" },
      ],
    });
  } else if (input.applicableCostSourceCount === 0) {
    items.push({
      id: "no-applicable-source",
      kind: "review",
      title: "Fonte fora da região",
      description: "As fontes cadastradas não atendem à cidade/UF do cenário. Revise metadados ou crie uma fonte manual.",
      status: "revisar",
      tone: "warning",
      actions: [
        { label: "Revisar fonte", href: "#manual-price-source" },
        { label: "Definir região", href: "/edit", variant: "outline" },
      ],
    });
  }

  if (input.pendingPriceCount > 0) {
    items.push({
      id: "pending-prices",
      kind: "manual-price",
      title: "Preços pendentes",
      description: "Itens sem fonte revisada continuam preliminares. Informe preço ou gere sugestões a partir das fontes existentes.",
      status: `${input.pendingPriceCount} pendente(s)`,
      tone: "warning",
      actions: [
        { label: "Preencher preço", href: "#manual-price-link" },
        { label: "Gerar sugestões", href: "#matching-assisted", variant: "outline" },
      ],
    });
  }

  if (input.lowConfidenceCount > 0) {
    items.push({
      id: "low-confidence-prices",
      kind: "review",
      title: "Preço pendente de revisão",
      description: "Itens de baixa confiança precisam de fonte, data-base e aprovação humana antes do orçamento revisado.",
      status: `${input.lowConfidenceCount} revisão`,
      tone: "warning",
      actions: [{ label: "Revisar fonte", href: "#review-report" }],
    });
  }

  return items;
}

export function createExportGuidance(input: ExportGuidanceInput): GuidedActionItem[] {
  const items: GuidedActionItem[] = [];

  if (input.pendingBudgetItemCount > 0) {
    items.push({
      id: "export-price-blockers",
      kind: "manual-price",
      title: "Exportação com preço pendente",
      description: "O arquivo pode sair como preliminar, mas preços sem fonte revisada devem ser resolvidos antes de aprovação.",
      status: `${input.pendingBudgetItemCount} pendente(s)`,
      tone: "warning",
      actions: [
        { label: "Revisar fonte", href: "/budget-assistant" },
        { label: "Preencher preço", href: "/budget-assistant#manual-price-link", variant: "outline" },
      ],
    });
  }

  if (input.pendingMaterialCount > 0) {
    items.push({
      id: "export-material-review",
      kind: "review",
      title: "Materiais a confirmar",
      description: "Revise quantidades e premissas antes de enviar lista para cotação ou compra.",
      status: `${input.pendingMaterialCount} revisão`,
      tone: "warning",
      actions: [{ label: "Revisar materiais", href: "/materials" }],
    });
  }

  if (input.warningCount > 0) {
    items.push({
      id: "export-technical-warnings",
      kind: "review",
      title: "Avisos técnicos",
      description: "Inclua os avisos no pacote preliminar e revise premissas antes de tratar como decisão de obra.",
      status: `${input.warningCount} aviso(s)`,
      tone: "pending",
      actions: [
        { label: "Abrir orçamento", href: "/budget" },
        { label: "Projeto técnico", href: "/technical-project", variant: "outline" },
      ],
    });
  }

  return items;
}
