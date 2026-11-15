import { describe, expect, it } from "vitest";
import { ruleImpact } from "../src/handoff/impact";
import { toWorkItem } from "../src/handoff/build";
import type { HandoffRecord } from "../src/handoff/types";
import { NO_RULES } from "../src/rules/types";

const record: HandoffRecord = { fromId: "a", toId: "b", acknowledged: [], preparedAt: "2026-11-15T00:00:00.000Z", acknowledgedAt: {}, protocol: 1 };
const mine = (key: string, assignee: string) =>
  toWorkItem(key, { project: { key: "OPS" }, summary: "x", description: "Body", duedate: "2026-12-10", assignee: { accountId: assignee } });

describe("ruleImpact", () => {
  it("counts only handoffs that are Clear now and would need information, and writes nothing", () => {
    const entries = [
      { item: mine("OPS-1", "b"), record },
      { item: mine("OPS-2", "c"), record },
      { item: mine("OPS-3", "c"), record: null },
    ];
    expect(ruleImpact(entries, [], NO_RULES, "requireReceiverAssigned")).toEqual({ checked: 2, wouldTurn: 1, keys: ["OPS-2"] });
  });

  it("counts nothing for a rule that is already released", () => {
    const entries = [{ item: mine("OPS-2", "c"), record }];
    expect(ruleImpact(entries, [], { ...NO_RULES, requireReceiverAssigned: true }, "requireReceiverAssigned").wouldTurn).toBe(0);
  });
});
