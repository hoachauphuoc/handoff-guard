import { describe, expect, it } from "vitest";
import { acknowledge } from "../src/handoff/acknowledge";
import { fingerprintOf } from "../src/handoff/drift";
import type { HandoffRecord } from "../src/handoff/types";
import type { WorkItem } from "../src/rules/types";

const item: WorkItem = { key: "OPS-1", projectKey: "OPS", summary: "s", description: "d", labels: [], components: [], dueDate: "2026-12-31", assigneeId: null };
const fp = fingerprintOf(item);
const record: HandoffRecord = { fromId: "a", toId: "b", acknowledged: [], preparedAt: "t0", acknowledgedAt: {} };

describe("acknowledge", () => {
  it("records the receiver's acknowledgement with its time", () => {
    const r = acknowledge(record, "b", "d1", ["d1", "d2"], "t1", fp, false);
    expect(r).toEqual({ ok: true, record: { ...record, acknowledged: ["d1"], acknowledgedAt: { d1: "t1" }, acknowledgedWith: { d1: fp } } });
    expect(record.acknowledged).toEqual([]);
  });
  it("refuses anyone but the receiver", () => {
    expect(acknowledge(record, "a", "d1", ["d1"], "t1", fp, false)).toEqual({ ok: false, reason: "not_receiver" });
    expect(acknowledge(record, null, "d1", ["d1"], "t1", fp, false)).toEqual({ ok: false, reason: "not_receiver" });
  });
  it("refuses a decision that does not bind the item", () => {
    expect(acknowledge(record, "b", "x", ["d1"], "t1", fp, false)).toEqual({ ok: false, reason: "not_binding" });
  });
  it("refuses a second acknowledgement", () => {
    const once = acknowledge(record, "b", "d1", ["d1"], "t1", fp, false);
    if (!once.ok) throw new Error("expected ok");
    expect(acknowledge(once.record, "b", "d1", ["d1"], "t2", fp, false)).toEqual({ ok: false, reason: "already_acknowledged" });
  });
});
