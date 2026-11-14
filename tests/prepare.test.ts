import { describe, expect, it } from "vitest";
import { mayPrepare } from "../src/handoff/prepare";
import type { HandoffRecord } from "../src/handoff/types";

const record: HandoffRecord = { fromId: "sender", toId: "receiver", acknowledged: [], preparedAt: "2026-11-14T00:00:00Z", acknowledgedAt: {} };

describe("mayPrepare", () => {
  it("is open before any record exists", () => {
    expect(mayPrepare(null, "anyone", null, false)).toBe(true);
  });
  it("lets the sender, the assignee and an admin prepare again", () => {
    expect(mayPrepare(record, "sender", "x", false)).toBe(true);
    expect(mayPrepare(record, "assignee", "assignee", false)).toBe(true);
    expect(mayPrepare(record, "boss", "x", true)).toBe(true);
  });
  it("refuses anyone else, and a viewer who is not signed in", () => {
    expect(mayPrepare(record, "bystander", "assignee", false)).toBe(false);
    expect(mayPrepare(record, null, null, true)).toBe(false);
  });
});
