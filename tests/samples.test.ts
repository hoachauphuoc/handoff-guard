import { describe, expect, it } from "vitest";
import { mergeDecisions, sampleDecisions } from "../src/samples/decisions";

describe("sampleDecisions", () => {
  it("has stable ids and uses the project key", () => {
    const ds = sampleDecisions("OPS");
    expect(ds.map((d) => d.id)).toEqual(["d-sample-1", "d-sample-2", "d-sample-3", "d-sample-4"]);
    expect(ds[0]?.scope).toEqual({ kind: "project", projectKey: "OPS" });
    expect(ds[3]?.status).toBe("superseded");
  });
  it("has valid ISO dates", () => {
    for (const d of sampleDecisions("OPS")) {
      for (const c of d.constraints) {
        if (c.kind === "dueNotAfter") {
          expect(new Date(`${c.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(c.date);
        }
      }
    }
  });
  it("merges idempotently and keeps unrelated decisions", () => {
    const other = { ...sampleDecisions("X")[0]!, id: "mine" };
    const once = mergeDecisions([other], sampleDecisions("OPS"));
    expect(once).toHaveLength(5);
    expect(mergeDecisions(once, sampleDecisions("OPS"))).toEqual(once);
  });
});
