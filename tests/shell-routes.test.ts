import { describe, expect, it } from "vitest";
import { buildStartRedirectUrl, canUseAppShellBeforeOnboarding, getAppShellProjectGuardState, shouldUsePublicShell } from "@/lib/routes/shell";

describe("root shell route selection", () => {
  it("keeps feedback public for visitors", () => {
    expect(shouldUsePublicShell("/feedback", false)).toBe(true);
  });

  it("keeps feedback inside the app shell for signed-in users before onboarding is complete", () => {
    expect(shouldUsePublicShell("/feedback", true, false)).toBe(false);
  });

  it("keeps feedback inside the app shell for signed-in users after onboarding is complete", () => {
    expect(shouldUsePublicShell("/feedback", true, true)).toBe(false);
  });

  it("keeps feedback inside the app shell for local projects after onboarding is complete", () => {
    expect(shouldUsePublicShell("/feedback", false, true)).toBe(false);
  });

  it("keeps auth routes public even for signed-in users", () => {
    expect(shouldUsePublicShell("/sign-in", true, true)).toBe(true);
    expect(shouldUsePublicShell("/sign-up", true, true)).toBe(true);
  });

  it("keeps start in the public shell before onboarding so method navigation is not shown first", () => {
    expect(shouldUsePublicShell("/start", true, false)).toBe(true);
    expect(shouldUsePublicShell("/start", true, true)).toBe(true);
  });

  it("keeps nested auth routes public without matching similar prefixes", () => {
    expect(shouldUsePublicShell("/sign-in/sso-callback", true, true)).toBe(true);
    expect(shouldUsePublicShell("/sign-up/verify", true, true)).toBe(true);
    expect(shouldUsePublicShell("/sign-internal", true, true)).toBe(false);
    expect(shouldUsePublicShell("/sign-upgrade", true, true)).toBe(false);
  });

  it("handles trailing slash routes like their canonical paths", () => {
    expect(shouldUsePublicShell("/feedback/", false)).toBe(true);
    expect(shouldUsePublicShell("/feedback/", false, true)).toBe(false);
    expect(shouldUsePublicShell("/feedback/", true, false)).toBe(false);
    expect(shouldUsePublicShell("/feedback/", true, true)).toBe(false);
  });

  it("allows feedback to render in the app shell before onboarding", () => {
    expect(canUseAppShellBeforeOnboarding("/feedback/")).toBe(true);
    expect(canUseAppShellBeforeOnboarding("/start")).toBe(false);
    expect(canUseAppShellBeforeOnboarding("/dashboard")).toBe(false);
  });

  it("allows admin feedback diagnostics before onboarding without making the route public", () => {
    expect(canUseAppShellBeforeOnboarding("/admin/feedback")).toBe(true);
    expect(shouldUsePublicShell("/admin/feedback", false, false)).toBe(false);
  });

  it("keeps internal routes in a hydration state before evaluating onboarding", () => {
    expect(
      getAppShellProjectGuardState({
        pathname: "/dashboard",
        projectHydrationStatus: "loading",
        onboardingCompleted: false,
      })
    ).toBe("hydrating");
  });

  it("allows internal routes only after the project has loaded and onboarding is complete", () => {
    expect(
      getAppShellProjectGuardState({
        pathname: "/dashboard",
        projectHydrationStatus: "loaded",
        onboardingCompleted: true,
      })
    ).toBe("ready");
    expect(
      getAppShellProjectGuardState({
        pathname: "/dashboard",
        projectHydrationStatus: "loaded",
        onboardingCompleted: false,
      })
    ).toBe("missing-project");
  });

  it("keeps before-onboarding app shell routes ready during hydration", () => {
    expect(
      getAppShellProjectGuardState({
        pathname: "/feedback",
        projectHydrationStatus: "loading",
        onboardingCompleted: false,
      })
    ).toBe("ready");
  });

  it("uses a safe start redirect that preserves the requested route", () => {
    expect(buildStartRedirectUrl("/dashboard", "project-required")).toBe("/start?reason=project-required&next=%2Fdashboard");
    expect(buildStartRedirectUrl("budget/", "project-invalid")).toBe("/start?reason=project-invalid&next=%2Fbudget");
  });
});
