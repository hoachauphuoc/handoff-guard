import { describe, expect, it } from "vitest";
import { bounceOf, lastAcknowledgedAt, toChanges, type Change } from "../src/autopsy/bounce";
import { autopsy, type AutopsyHandoff } from "../src/autopsy/causes";
import type { HandoffRecord } from "../src/handoff/types";

const record: HandoffRecord = {
  fromId: "sender",
  toId: "receiver",
  acknowledged: ["d1", "d2"],
  preparedAt: "2026-11-01T09:00:00.000Z",
  acknowledgedAt: { d1: "2026-11-01T10:00:00.000Z", d2: "2026-11-02T10:00:00.000Z" },
  protocol: 1,
};
const change = (created: string, field: string, from: string | null, to: string | null): Change => ({ created, items: [{ field, from, to }] });
const DONE = ["10002"];

describe("bounceOf", () => {
  it("takes the latest acknowledgement as the start", () => {
    expect(lastAcknowledgedAt(record)).toBe("2026-11-02T10:00:00.000Z");
    expect(lastAcknowledgedAt({ ...record, acknowledgedAt: {} })).toBeNull();
  });
  it("finds a return to the sender and a reopen inside the window, the earliest first", () => {
    const back = change("2026-11-04T10:00:00.000Z", "assignee", "receiver", "Sender");
    const reopened = change("2026-11-03T10:00:00.000Z", "status", "10002", "10001");
    expect(bounceOf([back], record, DONE)).toEqual({ kind: "returned_to_sender", at: back.created });
    expect(bounceOf([back, reopened], record, DONE)).toEqual({ kind: "reopened", at: reopened.created });
  });
  it("ignores changes before the acknowledgement, after the window, and ones that are not a bounce", () => {
    expect(bounceOf([change("2026-11-02T09:00:00.000Z", "assignee", "receiver", "sender")], record, DONE)).toBeNull();
    expect(bounceOf([change("2026-11-10T10:00:01.000Z", "assignee", "receiver", "sender")], record, DONE)).toBeNull();
    expect(bounceOf([change("2026-11-03T10:00:00.000Z", "assignee", "receiver", "third")], record, DONE)).toBeNull();
    expect(bounceOf([change("2026-11-03T10:00:00.000Z", "status", "10001", "10002")], record, DONE)).toBeNull();
    expect(bounceOf([change("2026-11-03T10:00:00.000Z", "status", "10002", "10003")], record, ["10002", "10003"])).toBeNull();
    expect(bounceOf([change("2026-11-03T10:00:00.000Z", "assignee", "receiver", "sender")], { ...record, acknowledgedAt: {} }, DONE)).toBeNull();
  });
});

describe("toChanges", () => {
  it("reads Jira's changelog and drops what it cannot read", () => {
    const raw = { values: [{ created: "2026-11-03T10:00:00.000Z", items: [{ field: "Assignee", fieldId: "assignee", from: "a", to: "b" }, { nothing: 1 }] }, { items: [] }, "x"] };
    expect(toChanges(raw)).toEqual([{ created: "2026-11-03T10:00:00.000Z", items: [{ field: "assignee", from: "a", to: "b" }] }]);
    expect(toChanges(null)).toEqual([]);
  });
});

describe("autopsy", () => {
  const h = (key: string, bounced: boolean, over: Partial<HandoffRecord> = {}, drifted = false, bindingCount = 2): AutopsyHandoff => ({
    key,
    record: { ...record, ...over },
    bounce: bounced ? { kind: "returned_to_sender", at: "2026-11-04T10:00:00.000Z" } : null,
    drifted,
    bindingCount,
  });
  it("counts each cause among the bounced handoffs and among the others", () => {
    const out = autopsy([
      h("A-1", true),
      h("A-2", true, { contingency: "call me" }),
      h("A-3", false, { contingency: "If the export fails, then roll back to the last release." }),
      h("A-4", false),
    ]);
    expect(out.total).toBe(4);
    expect(out.bounced.map((b) => b.key)).toEqual(["A-1", "A-2"]);
    const by = Object.fromEntries(out.causes.map((c) => [c.id, [c.bouncedWith, c.othersWith]]));
    expect(by.no_contingency).toEqual([1, 1]);
    expect(by.contingency_not_if_then).toEqual([1, 0]);
    expect(by.changed_after_read_back).toEqual([0, 0]);
  });
  it("offers a rule only for the causes a rule can enforce", () => {
    expect(autopsy([]).causes.filter((c) => c.rule !== null).map((c) => c.id)).toEqual(["no_contingency", "contingency_not_if_then"]);
  });
});

describe("reading Jira", () => {
  it("reads the changelog expanded on a work item", () => {
    expect(toChanges({ histories: [{ created: "2026-11-03T10:00:00.000Z", items: [{ field: "status", from: "1", to: "2" }] }] })).toHaveLength(1);
  });
  it("collects the Done status ids of a project once each", async () => {
    const { doneStatusIds } = await import("../src/autopsy/bounce");
    const raw = [
      { statuses: [{ id: "1", statusCategory: { key: "new" } }, { id: "3", statusCategory: { key: "done" } }] },
      { statuses: [{ id: "3", statusCategory: { key: "done" } }, { id: "4", statusCategory: { key: "done" } }] },
    ];
    expect(doneStatusIds(raw)).toEqual(["3", "4"]);
    expect(doneStatusIds({})).toEqual([]);
  });
});
