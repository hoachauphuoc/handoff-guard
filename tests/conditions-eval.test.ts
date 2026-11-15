import { describe, expect, it } from "vitest";
import { conditionJqls, conditionsOf, keyListJql, parseErrors, validJqls, withAnswers } from "../src/decisions/conditions";
import type { Decision, WorkItem } from "../src/rules/types";

const d = (id: string, jql: string, status: Decision["status"] = "decided"): Decision => ({
  id,
  title: id,
  status,
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "condition", jql }],
});

describe("condition evaluation helpers", () => {
  it("collects each JQL once, from decisions in force only", () => {
    expect(conditionJqls([d("A", "priority = Highest"), d("B", "priority = Highest"), d("C", "status = Review", "superseded")])).toEqual(["priority = Highest"]);
  });

  it("accepts a query only when Jira parsed it without errors and without ORDER BY", () => {
    const body = { queries: [{ query: "a", structure: {} }, { query: "b", errors: ["Field 'x' does not exist"] }, { query: "c", structure: { orderBy: {} } }] };
    expect([...validJqls(["a", "b", "c", "d"], body)]).toEqual(["a"]);
    expect(parseErrors({ queries: [{ errors: ["Field 'x' does not exist"] }] })).toEqual(["Field 'x' does not exist"]);
    expect(parseErrors({ queries: [{ structure: { orderBy: {} } }] })[0]).toContain("ORDER BY");
    expect(parseErrors({})).toEqual(["Jira did not answer for this filter."]);
    expect(parseErrors({ queries: [{ structure: {} }] })).toEqual([]);
  });

  it("asks about the given work items only, and drops a key that is not a key", () => {
    expect(keyListJql(["OPS-1", "OPS-2", 'x" OR "1'], "priority = Highest")).toBe('key in ("OPS-1", "OPS-2") AND (priority = Highest)');
  });

  it("answers true, false, or null when the search failed or was not run", () => {
    const matched = new Map<string, Set<string> | null>([["a", new Set(["OPS-1"])], ["b", null]]);
    const out = conditionsOf(["OPS-1", "OPS-2"], ["a", "b", "c"], matched);
    expect(out.get("OPS-1")).toEqual({ a: true, b: null, c: null });
    expect(out.get("OPS-2")).toEqual({ a: false, b: null, c: null });
  });

  it("puts the answers on the matching work item and leaves the rest as they were", () => {
    const item = { key: "OPS-1" } as WorkItem;
    const rows = withAnswers([{ item }, { item: { key: "OPS-9" } as WorkItem }], new Map([["OPS-1", { a: true }]]));
    expect(rows[0]!.item.conditions).toEqual({ a: true });
    expect(rows[1]!.item.conditions).toBeUndefined();
  });
});
