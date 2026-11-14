import { describe, expect, it } from "vitest";
import { AUDIT_CAP, appendEvent, monthCounts, type AuditEvent } from "../src/audit";

const ev = (at: string, action: AuditEvent["action"]): AuditEvent => ({ at, who: "u1", action, ref: "OPS-1" });

describe("appendEvent", () => {
  it("puts the newest first and never grows past the cap", () => {
    let list: AuditEvent[] = [];
    for (let i = 0; i < AUDIT_CAP + 5; i++) list = appendEvent(list, ev(`2026-11-14T00:00:${String(i % 60).padStart(2, "0")}Z`, "handoff_prepared"));
    expect(list).toHaveLength(AUDIT_CAP);
    const newest = ev("2026-12-01T00:00:00Z", "decision_added");
    expect(appendEvent(list, newest)[0]).toEqual(newest);
  });
  it("keeps only action, person, time and reference", () => {
    expect(Object.keys(ev("2026-11-14T00:00:00Z", "readback_refused")).sort()).toEqual(["action", "at", "ref", "who"]);
  });
});

describe("monthCounts", () => {
  it("counts per month, newest month first", () => {
    const rows = monthCounts([
      ev("2026-12-02T00:00:00Z", "handoff_prepared"),
      ev("2026-12-01T00:00:00Z", "readback_refused"),
      ev("2026-11-20T00:00:00Z", "handoff_prepared"),
      ev("2026-11-19T00:00:00Z", "handoff_acknowledged"),
      ev("2026-11-18T00:00:00Z", "decision_added"),
      ev("2026-11-18T00:00:00Z", "decision_confirmed"),
      ev("2026-11-17T00:00:00Z", "samples_loaded"),
    ]);
    expect(rows).toEqual([
      { month: "2026-12", prepared: 1, acknowledged: 0, refused: 1, decisions: 0 },
      { month: "2026-11", prepared: 1, acknowledged: 1, refused: 0, decisions: 2 },
    ]);
  });
});
