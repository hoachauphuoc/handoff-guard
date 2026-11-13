/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { leavingView } from "../src/decisions/leaving";
import type { HandoffRecord } from "../src/handoff/types";
import type { Decision, WorkItem } from "../src/rules/types";
import resolversSource from "../src/resolvers/index?raw";

const item = (key: string, over: Partial<WorkItem> = {}): WorkItem => ({
  key,
  projectKey: "OPS",
  summary: `s ${key}`,
  description: "d",
  labels: [],
  components: [],
  dueDate: "2026-12-01",
  assigneeId: null,
  ...over,
});
const decision = (over: Partial<Decision> = {}): Decision => ({
  id: "d1",
  title: "Ship by mid December",
  status: "decided",
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-15" }],
  confirmedBy: "alice",
  ...over,
});
const record = (over: Partial<HandoffRecord> = {}): HandoffRecord => ({
  fromId: "alice",
  toId: "bob",
  acknowledged: [],
  preparedAt: "2026-11-01T00:00:00.000Z",
  acknowledgedAt: {},
  ...over,
});

describe("leavingView assigned", () => {
  it("lists the person's items with the handoff verdict, no handoff first then worst first", () => {
    const entries = [
      { item: item("OPS-1", { assigneeId: "alice" }), record: record({ acknowledged: ["d1"] }) },
      { item: item("OPS-2", { assigneeId: "alice" }), record: record() },
      { item: item("OPS-3", { assigneeId: "alice", dueDate: "2026-12-20" }), record: record({ acknowledged: ["d1"] }) },
      { item: item("OPS-9", { assigneeId: "alice" }), record: null },
    ];
    const out = leavingView("alice", entries, [decision()], "OPS", 4, false);
    expect(out.personId).toBe("alice");
    expect(out.assigned).toEqual([
      { key: "OPS-9", summary: "s OPS-9", handoff: "none" },
      { key: "OPS-3", summary: "s OPS-3", handoff: { toId: "bob", verdict: "blocked" } },
      { key: "OPS-2", summary: "s OPS-2", handoff: { toId: "bob", verdict: "needs_info" } },
      { key: "OPS-1", summary: "s OPS-1", handoff: { toId: "bob", verdict: "clear" } },
    ]);
  });

  it("leaves out items assigned to someone else and matches the assignee loosely", () => {
    const entries = [
      { item: item("OPS-1", { assigneeId: "bob" }), record: null },
      { item: item("OPS-2", { assigneeId: null }), record: null },
      { item: item("OPS-3", { assigneeId: " Alice " }), record: null },
    ];
    expect(leavingView("alice", entries, [], "OPS", 3, false).assigned.map((a) => a.key)).toEqual(["OPS-3"]);
  });
});

describe("leavingView toAcknowledge", () => {
  it("counts the binding decisions the person has not acknowledged yet, by key", () => {
    const decisions = [decision(), decision({ id: "d2", title: "Note", constraints: [] })];
    const entries = [
      { item: item("OPS-B"), record: record({ fromId: "carol", toId: "alice", acknowledged: ["d1"] }) },
      { item: item("OPS-A"), record: record({ fromId: "carol", toId: "alice" }) },
    ];
    expect(leavingView("alice", entries, decisions, "OPS", 2, false).toAcknowledge).toEqual([
      { key: "OPS-A", summary: "s OPS-A", fromId: "carol", waiting: 2 },
      { key: "OPS-B", summary: "s OPS-B", fromId: "carol", waiting: 1 },
    ]);
  });

  it("leaves out fully acknowledged handoffs and handoffs to someone else", () => {
    const entries = [
      { item: item("OPS-1"), record: record({ toId: "alice", acknowledged: ["d1"] }) },
      { item: item("OPS-2"), record: record({ toId: "bob" }) },
      { item: item("OPS-3"), record: null },
    ];
    expect(leavingView("alice", entries, [decision()], "OPS", 3, false).toAcknowledge).toEqual([]);
  });
});

describe("leavingView decisions", () => {
  it("lists decided, person-confirmed decisions that can bind this project, by title", () => {
    const decisions = [
      decision({ id: "z", title: "Zebra rule" }),
      decision({ id: "a", title: "Apple rule" }),
      decision({ id: "legacy", title: "Legacy label rule", scope: { kind: "label", label: "launch" } }),
      decision({ id: "own-item", title: "This item rule", scope: { kind: "workItem", key: "OPS-7" } }),
    ];
    expect(leavingView("alice", [], decisions, "OPS", 0, false).decisions).toEqual([
      { id: "a", title: "Apple rule", reach: "Applies to: every work item in project OPS" },
      { id: "legacy", title: "Legacy label rule", reach: "Applies to: every work item with label launch" },
      { id: "own-item", title: "This item rule", reach: "Applies to: this work item only" },
      { id: "z", title: "Zebra rule", reach: "Applies to: every work item in project OPS" },
    ]);
  });

  it("leaves out superseded, other-confirmed and other-project decisions", () => {
    const decisions = [
      decision({ id: "s", status: "superseded" }),
      decision({ id: "b", confirmedBy: "bob" }),
      decision({ id: "n", confirmedBy: undefined }),
      decision({ id: "e", scope: { kind: "project", projectKey: "ELSE" } }),
      decision({ id: "l", scope: { kind: "label", label: "launch", projectKey: "ELSE" } }),
      decision({ id: "w", scope: { kind: "workItem", key: "ELSE-1" } }),
    ];
    expect(leavingView("alice", [], decisions, "OPS", 0, false).decisions).toEqual([]);
  });
});

describe("leavingView counts", () => {
  it("carries scanned and capped through", () => {
    expect(leavingView("alice", [], [], "OPS", 7, true)).toMatchObject({ scanned: 7, capped: true });
  });
});

describe("getLeaving stays read-only", () => {
  it("writes nothing in its resolver", () => {
    const start = resolversSource.indexOf('resolver.define("getLeaving"');
    expect(start).toBeGreaterThanOrEqual(0);
    const next = resolversSource.indexOf("resolver.define(", start + 1);
    const slice = next === -1 ? resolversSource.slice(start) : resolversSource.slice(start, next);
    expect(slice).not.toMatch(/\bput\w*\(/);
    expect(slice).not.toMatch(/\.set\(/);
  });
});

describe("leavingView and work the person received", () => {
  it("does not count a handoff that made them the receiver as handing the work over", () => {
    const entries = [{ item: item("OPS-4", { assigneeId: "bob" }), record: record({ acknowledged: ["d1"] }) }];
    expect(leavingView("bob", entries, [decision()], "OPS", 1, false).assigned).toEqual([{ key: "OPS-4", summary: "s OPS-4", handoff: "none" }]);
  });
});
