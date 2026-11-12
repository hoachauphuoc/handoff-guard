import { describe, expect, it } from "vitest";
import { capParts } from "../src/decisions/cap";
import type { SourcePart } from "../src/decisions/types";

describe("caps", () => {
  it("cuts the total across parts and says so", () => {
    const raw: SourcePart[] = [
      { from: "a", text: "x".repeat(15) },
      { from: "b", text: "y".repeat(15) },
      { from: "c", text: "z" },
    ];
    const out = capParts(raw, 20);
    expect(out.parts.map((p) => p.text.length)).toEqual([15, 5]);
    expect(out.truncated).toBe(true);
    expect(capParts(raw, 100).truncated).toBe(false);
  });
});
