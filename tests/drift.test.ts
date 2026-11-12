/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { acknowledge } from "../src/handoff/acknowledge";
import { handoffFrom } from "../src/handoff/build";
import { changesSince, driftByDecision, fingerprintOf, staleAcks, touches } from "../src/handoff/drift";
import type { HandoffRecord } from "../src/handoff/types";
import { checkHandoff } from "../src/rules/checkHandoff";
import type { Decision, WorkItem } from "../src/rules/types";
import driftSource from "../src/handoff/drift?raw";

const item = (over: Partial<WorkItem> = {}): WorkItem => ({
  key: "OPS-1",
  projectKey: "OPS",
  summary: "Launch",
  description: "Body",
  labels: ["launch"],
  components: ["web"],
  dueDate: "2026-12-31",
  assigneeId: null,
  ...over,
});
const due = (over: Partial<Decision> = {}): Decision => ({
  id: "d1",
  title: "Ship by 31 December",
  status: "decided",
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-31" }],
  ...over,
});
const record = (over: Partial<HandoffRecord> = {}): HandoffRecord => ({ fromId: "a", toId: "b", acknowledged: [], preparedAt: "t0", acknowledgedAt: {}, ...over });

describe("changesSince", () => {
  const fp = fingerprintOf(item());

  it("is empty for the same item", () => {
    expect(changesSince(fp, item())).toEqual([]);
  });

  it("shows before and after for due date, labels and components, and only 'changed' for text", () => {
    const now = item({ dueDate: "2026-12-15", labels: ["Launch", "legal"], components: [], summary: "Launch v2", description: "Other body" });
    expect(changesSince(fp, now).map((c) => c.text)).toEqual([
      "due 2026-12-31 to 2026-12-15",
      "labels: added legal",
      "components: removed web",
      "summary changed",
      "description changed",
    ]);
    expect(JSON.stringify(fp)).not.toContain("Body");
    expect(JSON.stringify(fp)).not.toContain("Launch");
  });

  it("says 'not set' for a missing due date and ignores case and order in lists", () => {
    expect(changesSince(fingerprintOf(item({ dueDate: null })), item())[0]?.text).toBe("due not set to 2026-12-31");
    expect(changesSince(fingerprintOf(item({ labels: ["b", "A"] })), item({ labels: ["a", "B"] }))).toEqual([]);
  });
});

describe("touches", () => {
  const change = (over: Partial<WorkItem>) => changesSince(fingerprintOf(item()), item(over));
  const labelReq = due({ constraints: [{ kind: "labelRequired", label: "Legal-Reviewed" }] });

  it("treats any due date change as touching a due date constraint only", () => {
    expect(change({ dueDate: "2026-12-15" }).map((c) => touches(due(), c))).toEqual([true]);
    expect(change({ dueDate: "2026-12-15" }).map((c) => touches(labelReq, c))).toEqual([false]);
  });

  it("ignores an unrelated label but not the one a constraint names", () => {
    expect(change({ labels: ["launch", "unrelated"] }).map((c) => touches(labelReq, c))).toEqual([false]);
    expect(change({ labels: ["launch", "legal-reviewed"] }).map((c) => touches(labelReq, c))).toEqual([true]);
    expect(change({ labels: [] }).map((c) => touches(due({ constraints: [{ kind: "labelForbidden", label: "launch" }] }), c))).toEqual([true]);
  });

  it("reads a label scope as its own label only", () => {
    const scoped = due({ scope: { kind: "label", label: "launch" } });
    expect(change({ labels: [] }).map((c) => touches(scoped, c))).toEqual([true]);
    expect(change({ labels: ["launch", "x"] }).map((c) => touches(scoped, c))).toEqual([false]);
  });

  it("matches components by the named value and never touches on text", () => {
    const comp = due({ constraints: [{ kind: "componentRequired", component: "web" }] });
    expect(change({ components: [] }).map((c) => touches(comp, c))).toEqual([true]);
    expect(change({ components: ["web", "api"] }).map((c) => touches(comp, c))).toEqual([false]);
    expect(change({ description: "x", summary: "y" }).map((c) => touches(comp, c))).toEqual([false, false]);
  });
});

describe("staleAcks", () => {
  const acked = record({ acknowledged: ["d1"], acknowledgedWith: { d1: fingerprintOf(item()) } });

  it("marks only decisions whose inputs changed, with the reason", () => {
    expect(staleAcks(acked.acknowledged, acked.acknowledgedWith, item({ dueDate: "2026-12-15" }), [due()])).toEqual({ d1: "due 2026-12-31 to 2026-12-15 since then" });
    expect(staleAcks(acked.acknowledged, acked.acknowledgedWith, item({ labels: ["x"] }), [due()])).toEqual({});
    const req = due({ constraints: [{ kind: "labelRequired", label: "legal-reviewed" }] });
    const ackedReq = { d1: fingerprintOf(item({ labels: ["legal-reviewed"] })) };
    expect(staleAcks(["d1"], ackedReq, item({ labels: ["legal-reviewed", "unrelated"] }), [req])).toEqual({});
    expect(staleAcks(["d1"], ackedReq, item({ labels: [] }), [req])).toEqual({ d1: "labels: removed legal-reviewed since then" });
    expect(staleAcks(acked.acknowledged, acked.acknowledgedWith, item({ description: "new" }), [due()])).toEqual({});
  });

  it("never marks an acknowledgement that has no stored baseline, or a decision not acknowledged", () => {
    expect(staleAcks(["d1"], undefined, item({ dueDate: "2027-01-01" }), [due()])).toEqual({});
    expect(staleAcks([], acked.acknowledgedWith, item({ dueDate: "2027-01-01" }), [due()])).toEqual({});
  });

  it("lists every change per acknowledged decision, including text, for the panel", () => {
    expect(driftByDecision(acked.acknowledged, acked.acknowledgedWith, item({ description: "new" }))).toEqual({ d1: ["description changed"] });
    expect(driftByDecision(["d1"], undefined, item({ description: "new" }))).toEqual({});
  });
});

describe("a stale acknowledgement in the verdict", () => {
  const d = due();
  const acked = record({ acknowledged: ["d1"], acknowledgedWith: { d1: fingerprintOf(item()) } });

  it("stays clear while nothing the decision reads changed", () => {
    expect(checkHandoff(handoffFrom(item(), acked, [d]), [d])).toEqual({ verdict: "clear", findings: [], binding: [d] });
    expect(checkHandoff(handoffFrom(item({ description: "edited" }), acked, [d]), [d]).verdict).toBe("clear");
  });

  it("counts as not acknowledged, with the reason, through the existing finding", () => {
    const r = checkHandoff(handoffFrom(item({ dueDate: "2026-12-15" }), acked, [d]), [d]);
    expect(r.verdict).toBe("needs_info");
    expect(r.findings).toEqual([
      {
        rule: "decision_not_acknowledged",
        severity: "info_needed",
        message: 'The receiver acknowledged "Ship by 31 December", but due 2026-12-31 to 2026-12-15 since then; it needs to be acknowledged again.',
        decisionId: "d1",
      },
    ]);
  });

  it("leaves a record acknowledged before fingerprints as it was", () => {
    const old = record({ acknowledged: ["d1"] });
    expect(checkHandoff(handoffFrom(item({ dueDate: "2026-12-15" }), old, [d]), [d]).verdict).toBe("clear");
  });

  it("is cleared by acknowledging again, which takes a new baseline", () => {
    const now = item({ dueDate: "2026-12-15" });
    const stale = staleAcks(acked.acknowledged, acked.acknowledgedWith, now, [d]);
    expect("d1" in stale).toBe(true);
    const again = acknowledge(acked, "b", "d1", ["d1"], "t2", fingerprintOf(now), true);
    if (!again.ok) throw new Error("expected ok");
    expect(again.record.acknowledged).toEqual(["d1"]);
    expect(again.record.acknowledgedAt.d1).toBe("t2");
    expect(checkHandoff(handoffFrom(now, again.record, [d]), [d]).verdict).toBe("clear");
  });

  it("still refuses a repeat acknowledgement that is not stale", () => {
    expect(acknowledge(acked, "b", "d1", ["d1"], "t2", fingerprintOf(item()), false)).toEqual({ ok: false, reason: "already_acknowledged" });
  });
});

describe("drift keeps the clock out", () => {
  it("reads no clock and no Forge API", () => {
    expect(driftSource).not.toMatch(/Date\.now|new Date|@forge/);
  });
});
