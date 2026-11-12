/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { applyModifiedFields } from "../src/handoff/build";
import { detectReassignment } from "../src/handoff/detect";
import type { HandoffRecord } from "../src/handoff/types";
import { watchAssignee } from "../src/rules/advisories";
import type { Decision, WorkItem } from "../src/rules/types";
import { runIssueUpdated } from "../src/trigger";
import rulesSource from "../src/rules/checkHandoff?raw";
import detectSource from "../src/handoff/detect?raw";
import manifest from "../manifest.yml?raw";

const NOW = "2026-11-12T10:00:00.000Z";
const change = (from: string | null, to: string | null) => [{ field: "assignee", fieldId: "assignee", from, to }];
const existing: HandoffRecord = { fromId: "a", toId: "b", acknowledged: ["d1"], preparedAt: "t0", acknowledgedAt: { d1: "t1" }, origin: "manual" };

describe("detectReassignment", () => {
  it("turns an assignee change into a handoff from the old assignee to the new one", () => {
    expect(detectReassignment(change("a", "b"), null, NOW)).toEqual({
      fromId: "a",
      toId: "b",
      acknowledged: [],
      preparedAt: NOW,
      acknowledgedAt: {},
      origin: "reassignment",
      protocol: 1,
    });
  });

  it("records nothing when no one handed anything over", () => {
    expect(detectReassignment(change(null, "b"), null, NOW)).toBeNull();
    expect(detectReassignment(change("a", null), null, NOW)).toBeNull();
    expect(detectReassignment(change("a", " A"), null, NOW)).toBeNull();
    expect(detectReassignment([{ field: "labels", from: "x", to: "y" }], null, NOW)).toBeNull();
    expect(detectReassignment(undefined, null, NOW)).toBeNull();
    expect(detectReassignment("assignee", null, NOW)).toBeNull();
  });

  it("keeps acknowledgements when the receiver is unchanged and drops them for a new receiver", () => {
    expect(detectReassignment(change("x", "B"), existing, NOW)).toBeNull();
    const next = detectReassignment(change("b", "c"), existing, NOW);
    expect(next).toMatchObject({ fromId: "b", toId: "c", acknowledged: [], acknowledgedAt: {}, origin: "reassignment" });
  });

  it("takes the last change when a changelog lists several", () => {
    expect(detectReassignment([...change("a", "b"), ...change("b", "c")], null, NOW)).toMatchObject({ fromId: "b", toId: "c" });
  });
});

describe("runIssueUpdated", () => {
  const deps = (stored: HandoffRecord | null) => {
    const writes: [string, HandoffRecord][] = [];
    return {
      writes,
      d: { getRecord: async () => stored, putRecord: async (id: string, r: HandoffRecord) => void writes.push([id, r]), now: () => NOW },
    };
  };

  it("writes the detected record under the issue id", async () => {
    const { d, writes } = deps(null);
    await runIssueUpdated({ issue: { id: 10001 }, changelog: { items: change("a", "b") } }, d);
    expect(writes).toEqual([["10001", expect.objectContaining({ fromId: "a", toId: "b", origin: "reassignment" })]]);
  });

  it("writes nothing for other edits or a malformed event", async () => {
    const { d, writes } = deps(null);
    await runIssueUpdated({ issue: { id: "1" }, changelog: { items: [{ field: "summary" }] } }, d);
    await runIssueUpdated({}, d);
    await runIssueUpdated({ issue: { id: "1" } }, d);
    expect(writes).toEqual([]);
  });
});

describe("watchAssignee", () => {
  const item = (assigneeId: string | null): WorkItem => ({ key: "OPS-1", projectKey: "OPS", summary: "s", description: "d", labels: [], components: [], dueDate: null, assigneeId });
  const bound = { id: "d1", title: "t", status: "decided", source: { kind: "ledger", ref: "r" }, scope: { kind: "project", projectKey: "OPS" }, constraints: [] } as Decision;

  it("says so when the assignee is not the receiver of the prepared handoff", () => {
    expect(watchAssignee(item("z"), { toId: "b" }, []).map((a) => a.kind)).toEqual(["assignee_differs_from_handoff"]);
    expect(watchAssignee(item("B"), { toId: "b" }, [])).toEqual([]);
  });

  it("notes an assigned item with binding decisions and no handoff, and is silent otherwise", () => {
    expect(watchAssignee(item("z"), null, [bound]).map((a) => a.message)).toEqual(["This work item has an assignee and 1 decision in force, but no handoff is prepared."]);
    expect(watchAssignee(item("z"), null, [])).toEqual([]);
    expect(watchAssignee(item(null), null, [bound])).toEqual([]);
  });
});

describe("reassignment stays out of the rules", () => {
  it("is not imported by the rule file or by detect's own dependencies beyond norm", () => {
    expect(rulesSource).not.toMatch(/detect|trigger/);
    expect(detectSource).not.toMatch(/@forge|fetch|Date\.now|new Date/);
  });

  it("declares one trigger on the issue-updated event and no new scope", () => {
    expect(manifest).toMatch(/trigger:\s*\n\s*- key: handoff-guard-reassigned/);
    expect(manifest).toMatch(/avi:jira:updated:issue/);
  });
});

describe("an agent as the new assignee", () => {
  // Shape assumed from the Jira changelog contract: `from` and `to` are account ids. A Rovo agent is reported
  // to have its own Atlassian user identity, so it should look like any other id. Not yet seen on a site.
  it("is recorded like any other receiver when the changelog carries an account id", () => {
    expect(detectReassignment(change("5b10ac8d82e05b22cc7d4ef5", "712020:11111111-2222-3333-4444-555555555555"), null, NOW)).toMatchObject({
      fromId: "5b10ac8d82e05b22cc7d4ef5",
      toId: "712020:11111111-2222-3333-4444-555555555555",
      origin: "reassignment",
    });
  });

  it("records nothing, without throwing, when the changelog carries something that is not an id", () => {
    for (const to of [{ accountId: "x" }, 42, ["x"]]) {
      expect(detectReassignment([{ field: "assignee", fieldId: "assignee", from: "a", to }], null, NOW)).toBeNull();
    }
  });

  it("leaves the assignee untouched when a transition screen sends one in modifiedFields", () => {
    const item: WorkItem = { key: "OPS-1", projectKey: "OPS", summary: "s", description: "d", labels: [], components: [], dueDate: "2026-12-31", assigneeId: "a" };
    expect(applyModifiedFields(item, { assignee: { accountId: "agent" } })).toEqual(item);
  });
});
