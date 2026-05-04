import { describe, expect, it } from "vitest";
import { shouldUsePublicShell } from "@/lib/routes/shell";

describe("root shell route selection", () => {
  it("keeps feedback public for visitors", () => {
    expect(shouldUsePublicShell("/feedback", false)).toBe(true);
  });

  it("keeps feedback inside the app shell for signed-in users", () => {
    expect(shouldUsePublicShell("/feedback", true)).toBe(false);
  });

  it("keeps auth routes public even for signed-in users", () => {
    expect(shouldUsePublicShell("/sign-in", true)).toBe(true);
    expect(shouldUsePublicShell("/sign-up", true)).toBe(true);
  });
});
