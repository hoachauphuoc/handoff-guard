import { describe, expect, it } from "vitest";
import { runDraftReceipt, runListBindingDecisions, type Deps } from "../src/actions/core";
import type { HandoffRecord } from "../src/handoff/types";
import type { Decision, WorkItem } from "../src/rules/types";

const item: WorkItem = { key: "OPS-1", projectKey: "OPS", summary: "Launch", description: "Body", labels: [], components: [], dueDate: "2026-12-10", assigneeId: "to" };
const decision: Decision = {
  id: "d1",
  title: "Work ships by the end of 2026",
  status: "decided",
  source: { kind: "ledger", ref: "x" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-31" }],
};
const never = async (): Promise<never> => {
  throw new Error("must not be called");
};

// Every store the action must not touch throws, so a draft that reached a record or a proposal would fail the test.
// The record is read only to know who the receiver is.
const record = { toId: "to" } as HandoffRecord;
function setup(decisions: Decision[] = [decision]) {
  const drafts: { issueId: string; draft: Record<string, string> }[] = [];
  const deps: Deps = {
    readItem: async () => ({ item, issueId: "10001" }),
    getDecisions: async () => decisions,
    getRecord: async () => record,
    readSource: never,
    getProposals: never,
    putProposals: never,
    people: never,
    now: () => "2026-11-15T00:00:00.000Z",
    putDraft: async (issueId, draft) => void drafts.push({ issueId, draft }),
  };
  return { deps, drafts };
}
const call = (answers: unknown, s = setup()) => runDraftReceipt({ issueKey: "OPS-1", answers }, "to", s.deps).then((out) => ({ out, drafts: s.drafts }));

describe("draft-receipt", () => {
  it("saves an accepted draft for the receiver to sign and says it acknowledges nothing", async () => {
    const { out, drafts } = await call(JSON.stringify({ "d1:0": "2026-12-15", stray: "x" }));
    expect(out).toMatchObject({ ok: true, saved: true, problems: [] });
    expect(drafts).toEqual([{ issueId: "10001", draft: { "d1:0": "2026-12-15" } }]);
    if (out.ok) expect(out.quote).toContain("acknowledges nothing");
  });

  it("refuses a date past the limit with the code's reason and saves nothing", async () => {
    const { out, drafts } = await call(JSON.stringify({ "d1:0": "2027-01-15" }));
    expect(out).toMatchObject({ ok: true, saved: false });
    if (out.ok) expect(out.problems).toEqual(['Your receipt gives 2027-01-15, later than 2026-12-31, the latest date "Work ships by the end of 2026" allows.']);
    expect(drafts).toEqual([]);
  });

  it("refuses a missing answer and names the slots so the agent can ask the user", async () => {
    const { out, drafts } = await call("{}");
    expect(out).toMatchObject({ ok: true, saved: false, slots: [{ key: "d1:0", kind: "date" }] });
    expect(drafts).toEqual([]);
  });

  it("rejects input that is not a JSON object in a string", async () => {
    for (const bad of [undefined, 5, "not json", "[]", '"x"']) expect((await call(bad)).out).toMatchObject({ ok: false, error: { code: "bad_input" } });
  });

  it("saves nothing when no decision binds the work item, and fails when it has nowhere to save", async () => {
    const none = await call(JSON.stringify({}), setup([]));
    expect(none.out).toMatchObject({ ok: true, saved: false });
    expect(none.drafts).toEqual([]);
    const s = setup();
    const { putDraft: _removed, ...withoutStore } = s.deps;
    expect(await runDraftReceipt({ issueKey: "OPS-1", answers: JSON.stringify({ "d1:0": "2026-12-15" }) }, "to", withoutStore)).toMatchObject({ ok: false });
  });
});

describe("draft-receipt is the receiver's", () => {
  const answers = JSON.stringify({ "d1:0": "2026-12-15" });
  it("refuses anyone but the receiver, and a work item with no prepared handoff, and saves nothing", async () => {
    for (const [who, rec] of [["someone", record], [null, record], ["to", null]] as const) {
      const s = setup();
      const out = await runDraftReceipt({ issueKey: "OPS-1", answers }, who, { ...s.deps, getRecord: async () => rec });
      expect(out).toMatchObject({ ok: false, error: { code: "not_allowed" } });
      expect(s.drafts).toEqual([]);
    }
  });
});

describe("list-binding-decisions", () => {
  it("returns the slots a draft has to answer", async () => {
    const out = await runListBindingDecisions({ issueKey: "OPS-1" }, setup().deps);
    expect(out).toMatchObject({ ok: true, slots: [{ key: "d1:0", decision: "Work ships by the end of 2026", kind: "date" }] });
  });
});
