import { describe, expect, it } from "vitest";
import { acknowledge, acknowledgeAll, checkReadBack } from "../src/handoff/acknowledge";
import { fingerprintOf } from "../src/handoff/drift";
import type { HandoffRecord } from "../src/handoff/types";
import type { Decision, WorkItem } from "../src/rules/types";

const item: WorkItem = { key: "OPS-1", projectKey: "OPS", summary: "s", description: "d", labels: [], components: [], dueDate: "2026-12-31", assigneeId: null };
const fp = fingerprintOf(item);
const record: HandoffRecord = { fromId: "a", toId: "b", acknowledged: [], preparedAt: "t0", acknowledgedAt: {} };
const proto: HandoffRecord = { ...record, protocol: 1 };
const due: Decision = {
  id: "d2",
  title: "Ship before 31 Dec",
  status: "decided",
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-31" }],
};
const FROM = "2026-12-01T00:00:00.000Z";

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

describe("checkReadBack", () => {
  const refused = (text: string) => {
    const out = acknowledgeAll(proto, "b", [due], text, FROM, fp);
    if (out.ok || out.reason !== "read_back") throw new Error("expected a read-back refusal");
    return out;
  };

  it("returns no problems for a read-back that acknowledgeAll accepts", () => {
    const text = "Ship before 31 Dec: I ship by 15 Dec and keep everything else as decided.";
    expect(acknowledgeAll(proto, "b", [due], text, FROM, fp).ok).toBe(true);
    expect(checkReadBack(text, [due], FROM)).toEqual({ problems: [], contradictions: [] });
  });

  it("returns the same reasons as acknowledgeAll for a date after a dueNotAfter decision", () => {
    const text = "Ship before 31 Dec: I will ship by 15 Jan instead, after the holidays are over.";
    const out = refused(text);
    expect(out.contradictions.map((c) => c.decisionId)).toEqual(["d2"]);
    expect(checkReadBack(text, [due], FROM)).toEqual({ problems: out.problems, contradictions: out.contradictions });
  });

  it("returns the same reasons as acknowledgeAll when a decision is not addressed", () => {
    const text = "I will follow everything that was decided here, I promise to do that.";
    const out = refused(text);
    expect(out.problems).toEqual(['Your read-back does not mention "Ship before 31 Dec" (date 2026-12-31).']);
    expect(checkReadBack(text, [due], FROM)).toEqual({ problems: out.problems, contradictions: out.contradictions });
  });
});
