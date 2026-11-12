/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { plainError } from "../src/errors";
import { decisionsAsOf, replayAt, replayDiff, replayInstant, undatedDecisions, type ReplayInput } from "../src/rules/replay";
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

  it("assumes a decision with no confirmation time was in force throughout, and leaves out one superseded without a time", () => {
    const demo = limit({ confirmedAt: undefined });
    expect(decisionsAsOf([demo], "2000-01-01T00:00:00.000Z")).toHaveLength(1);
    const endless = limit({ title: "Old rule", status: "superseded" });
    expect(decisionsAsOf([endless], AFTER)).toEqual([]);
    expect(decisionsAsOf([endless], BEFORE)).toEqual([]);
  });

  it("names the decisions it cannot date", () => {
    const demo = limit({ id: "a", title: "Demo rule", confirmedAt: undefined });
    const endless = limit({ id: "b", title: "Old rule", status: "superseded" });
    const dated = limit({ id: "c" });
    expect(undatedDecisions([demo, endless, dated])).toEqual({ leftOut: ["Old rule"], assumed: ["Demo rule"] });
    const result = replayDiff([input()], [demo, endless], BEFORE, AFTER);
    expect(result).toMatchObject({ leftOut: ["Old rule"], assumed: ["Demo rule"] });
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
    const out = replayDiff([input()], [limit()], BEFORE, AFTER).changes;
    expect(out).toEqual([{ key: "OPS-1", summary: "Launch", then: "clear", now: "blocked", changedBy: ["Ship by 15 December"] }]);
  });

  it("shows the reverse when a decision has since been superseded", () => {
    const d = limit({ confirmedAt: "2026-11-02T00:00:00.000Z", status: "superseded", supersededAt: "2026-11-11T00:00:00.000Z" });
    const out = replayDiff([input({ acknowledged: ["d1"], acknowledgedAt: { d1: "2026-11-03T00:00:00.000Z" } })], [d], "2026-11-10T00:00:00.000Z", AFTER).changes;
    expect(out.map((c) => [c.then, c.now, c.changedBy])).toEqual([["blocked", "clear", ["Ship by 15 December"]]]);
  });

  it("leaves out handoffs whose verdict did not change, and handoffs not yet prepared", () => {
    expect(replayDiff([input()], [], BEFORE, AFTER).changes).toEqual([]);
    expect(replayDiff([input({ preparedAt: "2026-11-09T00:00:00.000Z" })], [limit()], BEFORE, AFTER).changes).toEqual([]);
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

describe("replayInstant", () => {
  const NOW = "2026-11-12T08:30:00.000Z";

  it("takes the end of an earlier day, now for today, and nothing for tomorrow or a non-date", () => {
    expect(replayInstant("2026-11-11", NOW)).toBe("2026-11-11T23:59:59.999Z");
    expect(replayInstant("2026-11-12", NOW)).toBe(NOW);
    expect(replayInstant("2026-11-13", NOW)).toBeNull();
    expect(replayInstant("", NOW)).toBeNull();
    expect(replayInstant("2026-02-30", NOW)).toBeNull();
  });
});

describe("plainError", () => {
  it("shows only the sentence meant for the person", () => {
    expect(plainError(new Error("ForgeAppError: There was an error invoking the function - Pick a date that is today or earlier."))).toBe("Pick a date that is today or earlier.");
    expect(plainError("Error: plain")).toBe("plain");
    expect(plainError("Allow access: please")).toBe("Allow access: please");
  });
});
