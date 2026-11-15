import { describe, expect, it } from "vitest";
import { handoffFrom, toWorkItem } from "../src/handoff/build";
import type { HandoffRecord } from "../src/handoff/types";
import { checkHandoff } from "../src/rules/checkHandoff";
import { NO_RULES, type ProjectRules } from "../src/rules/types";

const item = toWorkItem("OPS-1", { project: { key: "OPS" }, summary: "Launch", description: "Body", duedate: "2026-12-10", assignee: { accountId: "b" } });
const record: HandoffRecord = { fromId: "a", toId: "b", acknowledged: [], preparedAt: "2026-11-15T00:00:00.000Z", acknowledgedAt: {}, protocol: 1 };
const check = (rules: ProjectRules | undefined, contingency?: string) => checkHandoff(handoffFrom(item, { ...record, ...(contingency === undefined ? {} : { contingency }) }, [], rules), []);
const ids = (r: ReturnType<typeof check>) => r.findings.map((f) => f.rule);

describe("optional project rules", () => {
  it("change nothing while both are off: the handoff is Clear with or without a contingency", () => {
    expect(check(undefined)).toMatchObject({ verdict: "clear", findings: [] });
    expect(check(NO_RULES)).toMatchObject({ verdict: "clear", findings: [] });
    expect(check(NO_RULES, "call me")).toMatchObject({ verdict: "clear", findings: [] });
  });

  it("require a contingency when switched on, as information still owed and never a block", () => {
    const out = check({ requireContingency: true, requireIfThen: false });
    expect(out.verdict).toBe("needs_info");
    expect(ids(out)).toEqual(["no_contingency"]);
    expect(check({ requireContingency: true, requireIfThen: false }, "call me").verdict).toBe("clear");
  });

  it("require the if-then form only of a contingency that was written", () => {
    const rules = { requireContingency: false, requireIfThen: true };
    expect(check(rules).verdict).toBe("clear");
    expect(ids(check(rules, "call me"))).toEqual(["contingency_not_if_then"]);
    expect(check(rules, "If the export fails, then roll back to the last release.").verdict).toBe("clear");
  });

  it("with both on, an empty contingency gets the one finding that says to write it", () => {
    expect(ids(check({ requireContingency: true, requireIfThen: true }))).toEqual(["no_contingency"]);
  });
});
