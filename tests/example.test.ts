import { describe, expect, it } from "vitest";
import { checkReadBack } from "../src/handoff/acknowledge";
import { exampleReadBack } from "../src/handoff/example";
import { sampleDecisions } from "../src/samples/decisions";

describe("exampleReadBack", () => {
  it("is accepted by the same check a real read-back gets, for the sample decisions", () => {
    const binding = sampleDecisions("OPS").filter((d) => d.status === "decided");
    const text = exampleReadBack(binding);
    for (const d of binding) expect(text).toContain(d.title);
    expect(checkReadBack(text, binding, "2026-11-14T00:00:00.000Z").problems).toEqual([]);
  });
  it("is empty when nothing binds", () => {
    expect(exampleReadBack([])).toBe("");
  });
});
