import { describe, expect, it } from "vitest";
import { buildManualDecision, readManualInput, type ManualInput } from "../src/decisions/manual";
import type { Decision } from "../src/rules/types";

const NOW = "2026-11-14T00:00:00.000Z";
const base: ManualInput = { title: "Ship by year end", scope: "project", scopeValue: "", constraint: "dueNotAfter", constraintValue: "2026-12-31" };
const build = (over: Partial<ManualInput> = {}, stored: Decision[] = []) => buildManualDecision({ ...base, ...over }, "OPS", stored, "u1", NOW);

describe("buildManualDecision", () => {
  it("builds a decided project decision confirmed by the person", () => {
    const r = build();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.decision).toMatchObject({ status: "decided", scope: { kind: "project", projectKey: "OPS" }, confirmedBy: "u1", confirmedAt: NOW });
    expect(r.decision.constraints).toEqual([{ kind: "dueNotAfter", date: "2026-12-31" }]);
  });

  it("gives the same id for the same decision typed twice", () => {
    const a = build();
    const b = build();
    expect(a.ok && b.ok && a.decision.id === b.decision.id).toBe(true);
  });

  it("binds a label to the project and a work item key to its project", () => {
    const l = build({ scope: "label", scopeValue: "launch", constraint: "labelRequired", constraintValue: "legal" });
    expect(l.ok && l.decision.scope).toEqual({ kind: "label", label: "launch", projectKey: "OPS" });
    const w = build({ scope: "workItem", scopeValue: "ops-7" });
    expect(w.ok && w.decision.scope).toEqual({ kind: "workItem", key: "OPS-7" });
    expect(build({ scope: "workItem", scopeValue: "HR-7" }).ok).toBe(false);
  });

  it("refuses a bad title, date or empty value", () => {
    expect(build({ title: "" }).ok).toBe(false);
    expect(build({ title: "x".repeat(121) }).ok).toBe(false);
    expect(build({ constraintValue: "2026-13-40" }).ok).toBe(false);
    expect(build({ constraint: "labelForbidden", constraintValue: "" }).ok).toBe(false);
    expect(build({ scope: "label", scopeValue: "" }).ok).toBe(false);
  });

  it("refuses a decision already in force", () => {
    const first = build();
    if (!first.ok) throw new Error("setup");
    const again = build({ title: "Same rule, other words" }, [first.decision]);
    expect(again.ok).toBe(false);
  });
});

describe("readManualInput", () => {
  it("rejects unknown scope or constraint kinds", () => {
    expect(typeof readManualInput({ scope: "site", constraint: "dueNotAfter" })).toBe("string");
    expect(typeof readManualInput({ scope: "project", constraint: "anything" })).toBe("string");
    expect(typeof readManualInput(null)).toBe("string");
  });
  it("trims and accepts a valid payload", () => {
    expect(readManualInput({ title: " t ", scope: "project", constraint: "dueNotAfter", constraintValue: " 2026-12-31 " })).toMatchObject({ title: "t", constraintValue: "2026-12-31" });
  });
});
