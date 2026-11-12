/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { decisionsAsOf, replayAt, replayDiff, type ReplayInput } from "../src/rules/replay";
import type { Decision, WorkItem } from "../src/rules/types";
import replaySource from "../src/rules/replay?raw";
import rulesSource from "../src/rules/checkHandoff?raw";
import validatorSource from "../src/validator?raw";

const item: WorkItem = { key: "OPS-1", projectKey: "OPS", summary: "Launch", description: "d", labels: [], components: [], dueDate: "2026-12-20", assigneeId: null };
const limit = (over: Partial<Decision> = {}): Decision => ({
  id: "d1",
  title: "Ship by 15 December",
  status: "decided",
  source: { kind: "jira", ref: "OPS-1" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-15" }],
  confirmedAt: "2026-11-10T09:00:00.000Z",
  ...over,
});
const input = (over: Partial<ReplayInput> = {}): ReplayInput => ({
  item,
  fromId: "a",
  toId: "b",
  acknowledged: [],
  acknowledgedAt: {},
  preparedAt: "2026-11-01T00:00:00.000Z",
  ...over,
});
const BEFORE = "2026-11-05T23:59:59.999Z";
const AFTER = "2026-11-12T00:00:00.000Z";

describe("decisionsAsOf", () => {
  it("keeps a decision from its confirmation until it is superseded, and returns it as decided", () => {
    const d = limit({ status: "superseded", supersededAt: "2026-11-11T00:00:00.000Z" });
    expect(decisionsAsOf([d], BEFORE)).toEqual([]);
    expect(decisionsAsOf([d], "2026-11-10T12:00:00.000Z").map((x) => [x.id, x.status])).toEqual([["d1", "decided"]]);
    expect(decisionsAsOf([d], AFTER)).toEqual([]);
  });

  it("treats a decision with no confirmation time as always in force, and one superseded without a time as current", () => {
    const demo = limit({ confirmedAt: undefined });
    expect(decisionsAsOf([demo], "2000-01-01T00:00:00.000Z")).toHaveLength(1);
    expect(decisionsAsOf([limit({ status: "superseded" })], AFTER)).toHaveLength(1);
  });
});

describe("replayAt", () => {
  it("is null before the handoff was prepared", () => {
    expect(replayAt(input({ preparedAt: "2026-11-09T00:00:00.000Z" }), [], BEFORE)).toBeNull();
  });

  it("ignores an acknowledgement given after the instant and keeps one with no time", () => {
    const d = limit({ constraints: [{ kind: "labelRequired", label: "x" }] });
    const i = input({ item: { ...item, labels: ["x"] }, acknowledged: ["d1"], acknowledgedAt: { d1: "2026-11-11T00:00:00.000Z" } });
    expect(replayAt(i, [d], "2026-11-10T12:00:00.000Z")?.verdict).toBe("needs_info");
    expect(replayAt(i, [d], AFTER)?.verdict).toBe("clear");
    expect(replayAt({ ...i, acknowledgedAt: {} }, [d], "2026-11-10T12:00:00.000Z")?.verdict).toBe("clear");
  });
});

describe("replayDiff", () => {
  it("lists a handoff that was clear before a decision was confirmed and is blocked now, with that decision", () => {
    const out = replayDiff([input()], [limit()], BEFORE, AFTER);
    expect(out).toEqual([{ key: "OPS-1", summary: "Launch", then: "clear", now: "blocked", changedBy: ["Ship by 15 December"] }]);
  });

  it("shows the reverse when a decision has since been superseded", () => {
    const d = limit({ confirmedAt: "2026-11-02T00:00:00.000Z", status: "superseded", supersededAt: "2026-11-11T00:00:00.000Z" });
    const out = replayDiff([input({ acknowledged: ["d1"], acknowledgedAt: { d1: "2026-11-03T00:00:00.000Z" } })], [d], "2026-11-10T00:00:00.000Z", AFTER);
    expect(out.map((c) => [c.then, c.now, c.changedBy])).toEqual([["blocked", "clear", ["Ship by 15 December"]]]);
  });

  it("leaves out handoffs whose verdict did not change, and handoffs not yet prepared", () => {
    expect(replayDiff([input()], [], BEFORE, AFTER)).toEqual([]);
    expect(replayDiff([input({ preparedAt: "2026-11-09T00:00:00.000Z" })], [limit()], BEFORE, AFTER)).toEqual([]);
  });

  it("is the same on every run for the same input", () => {
    const run = () => JSON.stringify(replayDiff([input()], [limit()], BEFORE, AFTER));
    expect(run()).toBe(run());
  });
});

describe("replay keeps the clock out of the rules", () => {
  it("reads no clock, and the rule check and validator never import it", () => {
    expect(replaySource).not.toMatch(/Date\.now|new Date\(/);
    for (const src of [rulesSource, validatorSource]) expect(src).not.toMatch(/replay/i);
  });
});
