import type { ConstructionMethodId } from "@/lib/construction-methods";
import { normalizePathname } from "@/lib/routes/shell";

const aframeOnlyRoutes = new Set(["/structure"]);

export function isAFrameOnlyAppRoute(pathname: string) {
  return aframeOnlyRoutes.has(normalizePathname(pathname));
}

export function isAppNavigationItemVisible(pathname: string, constructionMethod?: ConstructionMethodId) {
  return !isAFrameOnlyAppRoute(pathname) || constructionMethod === "aframe";
}
