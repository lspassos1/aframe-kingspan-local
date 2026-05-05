import { describe, expect, it } from "vitest";
import {
  getVisibleAppNavigationSections,
  isAdminOnlyAppRoute,
  isAFrameOnlyAppRoute,
  isAppNavigationItemVisible,
} from "@/lib/navigation/app-navigation";

describe("app navigation visibility by construction method", () => {
  it("treats structure as an A-frame-only route", () => {
    expect(isAFrameOnlyAppRoute("/structure")).toBe(true);
    expect(isAFrameOnlyAppRoute("/structure/")).toBe(true);
    expect(isAFrameOnlyAppRoute("/materials")).toBe(false);
  });

  it("treats admin navigation as authorized-only", () => {
    expect(isAdminOnlyAppRoute("/admin/feedback")).toBe(true);
    expect(isAdminOnlyAppRoute("/admin/feedback/")).toBe(true);
    expect(isAdminOnlyAppRoute("/dashboard")).toBe(false);
    expect(isAppNavigationItemVisible("/admin/feedback", "aframe", false)).toBe(false);
    expect(isAppNavigationItemVisible("/admin/feedback", "aframe", true)).toBe(true);
  });

  it("hides A-frame-only navigation for non-A-frame methods", () => {
    expect(isAppNavigationItemVisible("/structure", "aframe")).toBe(true);
    expect(isAppNavigationItemVisible("/structure", "conventional-masonry")).toBe(false);
    expect(isAppNavigationItemVisible("/structure", "eco-block")).toBe(false);
    expect(isAppNavigationItemVisible("/structure", "monolithic-eps")).toBe(false);
    expect(isAppNavigationItemVisible("/materials", "conventional-masonry")).toBe(true);
  });

  it("hides A-frame-only navigation when the active method is unknown", () => {
    expect(isAppNavigationItemVisible("/structure", undefined)).toBe(false);
    expect(isAppNavigationItemVisible("/materials", undefined)).toBe(true);
  });

  it("keeps the first navigation layer short and non-technical", () => {
    const sections = getVisibleAppNavigationSections("conventional-masonry", false);
    const primary = sections.find((section) => section.id === "primary");

    expect(primary?.items.map((item) => item.label)).toEqual(["Painel", "Dados da obra", "Orçamento", "Visual 3D", "Exportar"]);
  });

  it("keeps advanced navigation collapsed and method-aware", () => {
    const masonrySections = getVisibleAppNavigationSections("conventional-masonry", false);
    const aframeSections = getVisibleAppNavigationSections("aframe", false);
    const masonryAdvanced = masonrySections.find((section) => section.id === "advanced");
    const aframeAdvanced = aframeSections.find((section) => section.id === "advanced");

    expect(masonryAdvanced?.collapsible).toBe(true);
    expect(masonryAdvanced?.items.map((item) => item.label)).not.toContain("Estrutura A-frame");
    expect(aframeAdvanced?.items.map((item) => item.label)).toContain("Estrutura A-frame");
  });

  it("uses the same gated navigation groups for mobile and desktop rendering", () => {
    const sections = getVisibleAppNavigationSections("aframe", true);
    const utility = sections.find((section) => section.id === "utility");

    expect(sections.map((section) => section.id)).toEqual(["primary", "advanced", "utility"]);
    expect(utility?.items.map((item) => item.label)).toEqual(["Ajuda", "Melhorias", "Admin"]);
  });
});
