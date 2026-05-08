import type { ConstructionMethodId } from "@/lib/construction-methods";
import { normalizePathname } from "@/lib/routes/shell";

const aframeOnlyRoutes = new Set(["/structure"]);
const adminOnlyRoutes = new Set(["/admin/feedback"]);

export type AppNavigationSectionId = "primary" | "advanced" | "utility";

export interface AppNavigationItem {
  href: string;
  label: string;
  badge?: string;
  adminOnly?: boolean;
  aframeOnly?: boolean;
}

export interface AppNavigationSection {
  id: AppNavigationSectionId;
  title: string;
  collapsible: boolean;
  items: AppNavigationItem[];
}

export const appNavigationSections = [
  {
    id: "primary",
    title: "Principal",
    collapsible: false,
    items: [
      { href: "/dashboard", label: "Painel" },
      { href: "/edit", label: "Dados da obra" },
      { href: "/budget", label: "Orçamento" },
      { href: "/model-3d", label: "Visual 3D" },
      { href: "/export", label: "Exportar" },
    ],
  },
  {
    id: "advanced",
    title: "Avançado",
    collapsible: true,
    items: [
      { href: "/materials", label: "Materiais" },
      { href: "/technical-project", label: "Projeto técnico" },
      { href: "/structure", label: "Estrutura A-frame", aframeOnly: true },
      { href: "/settings", label: "Premissas" },
      { href: "/budget-assistant", label: "Base de preços" },
      { href: "/quotation", label: "Cotação" },
      { href: "/scenarios", label: "Cenários" },
    ],
  },
  {
    id: "utility",
    title: "Suporte",
    collapsible: false,
    items: [
      { href: "/help", label: "Ajuda" },
      { href: "/feedback", label: "Melhorias" },
      { href: "/admin/feedback", label: "Admin", adminOnly: true },
    ],
  },
] satisfies AppNavigationSection[];

export function isAFrameOnlyAppRoute(pathname: string) {
  return aframeOnlyRoutes.has(normalizePathname(pathname));
}

export function isAdminOnlyAppRoute(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);

  return normalizedPathname === "/admin" || normalizedPathname.startsWith("/admin/") || adminOnlyRoutes.has(normalizedPathname);
}

export function isAppNavigationItemVisible(pathname: string, constructionMethod?: ConstructionMethodId, isAdmin = false) {
  if (isAFrameOnlyAppRoute(pathname) && constructionMethod !== "aframe") return false;
  if (isAdminOnlyAppRoute(pathname) && !isAdmin) return false;

  return true;
}

export function getVisibleAppNavigationSections(constructionMethod?: ConstructionMethodId, isAdmin = false) {
  return appNavigationSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => isAppNavigationItemVisible(item.href, constructionMethod, isAdmin)),
  }));
}
