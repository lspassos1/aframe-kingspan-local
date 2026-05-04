import { describe, expect, it } from "vitest";
import { formatLocalDateInputValue } from "@/lib/date";

describe("date formatting", () => {
  it("formats date input values from local calendar fields", () => {
    const localDate = new Date(2026, 4, 4, 23, 30);

    expect(formatLocalDateInputValue(localDate)).toBe("2026-05-04");
  });
});
