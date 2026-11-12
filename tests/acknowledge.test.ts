import { describe, expect, it } from "vitest";
import { acknowledge } from "../src/handoff/acknowledge";
import type { HandoffRecord } from "../src/handoff/types";

const record: HandoffRecord = { fromId: "a", toId: "b", acknowledged: [], preparedAt: "t0", acknowledgedAt: {} };

describe("acknowledge", () => {
  it("records the receiver's acknowledgement with its time", () => {
    const r = acknowledge(record, "b", "d1", ["d1", "d2"], "t1");
    expect(r).toEqual({ ok: true, record: { ...record, acknowledged: ["d1"], acknowledgedAt: { d1: "t1" } } });
    expect(record.acknowledged).toEqual([]);
  });
  it("refuses anyone but the receiver", () => {
    expect(acknowledge(record, "a", "d1", ["d1"], "t1")).toEqual({ ok: false, reason: "not_receiver" });
    expect(acknowledge(record, null, "d1", ["d1"], "t1")).toEqual({ ok: false, reason: "not_receiver" });
  });
  it("refuses a decision that does not bind the item", () => {
    expect(acknowledge(record, "b", "x", ["d1"], "t1")).toEqual({ ok: false, reason: "not_binding" });
  });
  it("refuses a second acknowledgement", () => {
    const once = acknowledge(record, "b", "d1", ["d1"], "t1");
    if (!once.ok) throw new Error("expected ok");
    expect(acknowledge(once.record, "b", "d1", ["d1"], "t2")).toEqual({ ok: false, reason: "already_acknowledged" });
  });
});
