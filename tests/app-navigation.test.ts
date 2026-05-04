import { describe, expect, it } from "vitest";
import { isAFrameOnlyAppRoute, isAppNavigationItemVisible } from "@/lib/navigation/app-navigation";

describe("app navigation visibility by construction method", () => {
  it("treats structure as an A-frame-only route", () => {
    expect(isAFrameOnlyAppRoute("/structure")).toBe(true);
    expect(isAFrameOnlyAppRoute("/structure/")).toBe(true);
    expect(isAFrameOnlyAppRoute("/materials")).toBe(false);
  });

  it("hides A-frame-only navigation for non-A-frame methods", () => {
    expect(isAppNavigationItemVisible("/structure", "aframe")).toBe(true);
    expect(isAppNavigationItemVisible("/structure", "conventional-masonry")).toBe(false);
    expect(isAppNavigationItemVisible("/structure", "eco-block")).toBe(false);
    expect(isAppNavigationItemVisible("/structure", "monolithic-eps")).toBe(false);
    expect(isAppNavigationItemVisible("/materials", "conventional-masonry")).toBe(true);
  });
});
