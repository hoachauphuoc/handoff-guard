import { describe, expect, it } from "vitest";
import { applyModifiedFields, decisionGuardResponse, handoffFrom, toWorkItem, validatorResponse } from "../src/handoff/build";
import type { HandoffRecord } from "../src/handoff/types";

const item = toWorkItem("OPS-1", {
  project: { key: "OPS" },
  summary: "Launch",
  description: "Body",
  labels: ["a"],
  components: [{ name: "web" }],
  duedate: "2026-12-10",
  assignee: { accountId: "u1" },
});

describe("toWorkItem", () => {
  it("maps Jira fields and defaults missing ones", () => {
    expect(item).toMatchObject({ projectKey: "OPS", components: ["web"], assigneeId: "u1", dueDate: "2026-12-10" });
    expect(toWorkItem("X-1", {})).toMatchObject({ description: "", labels: [], dueDate: null, assigneeId: null });
  });
});

describe("applyModifiedFields", () => {
  it("applies due date and labels, clearing them on null", () => {
    expect(applyModifiedFields(item, { duedate: "2027-01-01", labels: ["b"] })).toMatchObject({
      dueDate: "2027-01-01",
      labels: ["b"],
    });
    expect(applyModifiedFields(item, { duedate: null, labels: null })).toMatchObject({ dueDate: null, labels: [] });
  });
  it("ignores description and components, and does not mutate", () => {
    const out = applyModifiedFields(item, { description: { type: "doc" }, components: [] });
    expect(out).toEqual(item);
    expect(applyModifiedFields(item, undefined)).toBe(item);
  });
});

describe("handoffFrom", () => {
  it("has no people without a record", () => {
    expect(handoffFrom(item, null, [])).toEqual({ item, fromId: null, toId: null, acknowledged: [] });
  });
  it("copies the record", () => {
    const r: HandoffRecord = { fromId: "a", toId: "b", acknowledged: ["d"], preparedAt: "t", acknowledgedAt: {} };
    expect(handoffFrom(item, r, [])).toEqual({ item, fromId: "a", toId: "b", acknowledged: ["d"], stale: {} });
  });
});

describe("validatorResponse", () => {
  it("allows only clear and joins messages", () => {
    expect(validatorResponse({ verdict: "clear", findings: [], binding: [] })).toEqual({ result: true });
    const f = (message: string) => ({ rule: "no_due_date" as const, severity: "info_needed" as const, message });
    expect(validatorResponse({ verdict: "needs_info", findings: [f("A."), f("B.")], binding: [] })).toEqual({
      result: false,
      errorMessage: "A. B.",
    });
  });
});

describe("decisionGuardResponse", () => {
  it("allows a work item with no finding and joins the messages otherwise", () => {
    expect(decisionGuardResponse([])).toEqual({ result: true });
    const f = (message: string) => ({ rule: "contradicts_decision" as const, severity: "block" as const, message });
    expect(decisionGuardResponse([f("A."), f("B.")])).toEqual({ result: false, errorMessage: "A. B." });
  });
});

describe("heldByThirdPerson", () => {
  it("is true only when the assignee is neither the sender nor the receiver", async () => {
    const { heldByThirdPerson } = await import("../src/handoff/build");
    expect(heldByThirdPerson(item, { fromId: "u1", toId: "u2" })).toBe(false);
    expect(heldByThirdPerson(item, { fromId: "u0", toId: "U1 " })).toBe(false);
    expect(heldByThirdPerson(item, { fromId: "u0", toId: "u2" })).toBe(true);
    expect(heldByThirdPerson({ ...item, assigneeId: null }, { fromId: "u0", toId: "u2" })).toBe(false);
  });
});
