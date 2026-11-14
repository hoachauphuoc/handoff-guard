import { describe, expect, it } from "vitest";
import { hasSamples, mergeDecisions, sampleDecisions } from "../src/samples/decisions";

describe("sampleDecisions", () => {
  it("has stable ids and uses the project key", () => {
    const ds = sampleDecisions("OPS");
    expect(ds.map((d) => d.id)).toEqual(["d-sample-1-ops", "d-sample-2-ops", "d-sample-3-ops", "d-sample-4-ops"]);
    expect(ds[0]?.scope).toEqual({ kind: "project", projectKey: "OPS" });
    expect(ds[2]?.scope).toEqual({ kind: "label", label: "launch", projectKey: "OPS" });
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

  it("loading in a second project keeps the first project's samples", () => {
    const both = mergeDecisions(sampleDecisions("TD"), sampleDecisions("MOBL"));
    expect(both).toHaveLength(8);
    expect(both.filter((d) => d.scope.kind === "project" && d.scope.projectKey === "TD")).toHaveLength(3);
  });
  it("knows a project has samples, also under the old shared ids, and not from another project's", () => {
    const old = sampleDecisions("TD").map((d, i) => ({ ...d, id: `d-sample-${i + 1}` }));
    expect(hasSamples(old, "td")).toBe(true);
    expect(hasSamples(old, "MOBL")).toBe(false);
    // A label sample stored before label decisions carried a project binds every project, but is not a project sample.
    const legacyLabel = { ...old[2]!, scope: { kind: "label" as const, label: "launch" } };
    expect(hasSamples([legacyLabel], "MOBL")).toBe(false);
  });
});
