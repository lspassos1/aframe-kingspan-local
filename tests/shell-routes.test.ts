import { describe, expect, it } from "vitest";
import { shouldUsePublicShell } from "@/lib/routes/shell";

describe("root shell route selection", () => {
  it("keeps feedback public for visitors", () => {
    expect(shouldUsePublicShell("/feedback", false)).toBe(true);
  });

  it("keeps feedback public for signed-in users before onboarding is complete", () => {
    expect(shouldUsePublicShell("/feedback", true, false)).toBe(true);
  });

  it("keeps feedback inside the app shell for signed-in users after onboarding is complete", () => {
    expect(shouldUsePublicShell("/feedback", true, true)).toBe(false);
  });

  it("keeps auth routes public even for signed-in users", () => {
    expect(shouldUsePublicShell("/sign-in", true, true)).toBe(true);
    expect(shouldUsePublicShell("/sign-up", true, true)).toBe(true);
  });

  it("keeps nested auth routes public without matching similar prefixes", () => {
    expect(shouldUsePublicShell("/sign-in/sso-callback", true, true)).toBe(true);
    expect(shouldUsePublicShell("/sign-up/verify", true, true)).toBe(true);
    expect(shouldUsePublicShell("/sign-internal", true, true)).toBe(false);
    expect(shouldUsePublicShell("/sign-upgrade", true, true)).toBe(false);
  });

  it("handles trailing slash routes like their canonical paths", () => {
    expect(shouldUsePublicShell("/feedback/", false)).toBe(true);
    expect(shouldUsePublicShell("/feedback/", true, false)).toBe(true);
    expect(shouldUsePublicShell("/feedback/", true, true)).toBe(false);
  });
});
