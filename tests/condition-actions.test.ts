import { describe, expect, it } from "vitest";
import { DRAFT_STORED, runCheckCondition, runDraftCondition, type ConditionDeps } from "../src/actions/conditions";
import { MAX_CONDITION_DRAFTS, tally, type ConditionDraft } from "../src/decisions/conditions";
import type { Decision, WorkItem } from "../src/rules/types";

const NOW = "2026-11-15T00:00:00.000Z";
const item = (key: string, conditions?: Record<string, boolean | null>): WorkItem => ({
  key,
  projectKey: "OPS",
  summary: "s",
  description: "d",
  labels: [],
  components: [],
  dueDate: null,
  assigneeId: null,
  ...(conditions ? { conditions } : {}),
});
const inForce: Decision = {
  id: "d-1",
  title: "Only Highest priority goes to review",
  status: "decided",
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "condition", jql: "priority = Highest" }],
  confirmedBy: "u-admin",
};

// Items answer both the condition in force and any filter asked about, as Jira would.
function fake(over: Partial<ConditionDeps> = {}) {
  let drafts: ConditionDraft[] = [];
  const calls = { openItems: [] as string[][], putDrafts: 0 };
  const deps: ConditionDeps = {
    getDecisions: async () => [inForce],
    isAdmin: async () => true,
    jqlErrors: async (jql) => (jql.includes("prioritee") ? ["Field 'prioritee' does not exist or you do not have permission to view it."] : []),
    openItems: async (_p, jqls) => {
      calls.openItems.push(jqls);
      const answer = (yes: boolean) => Object.fromEntries(["priority = Highest", ...jqls].map((q) => [q, yes]));
      return { items: [item("OPS-1", answer(true)), item("OPS-2", answer(false)), item("OPS-3")], capped: false };
    },
    getDrafts: async () => drafts,
    putDrafts: async (_p, next) => {
      calls.putDrafts += 1;
      drafts = next;
    },
    now: () => NOW,
    ...over,
  };
  return { deps, calls, drafts: () => drafts };
}

describe("tally", () => {
  it("counts an item Jira did not answer for apart, never as a match", () => {
    expect(tally([item("A-1", { q: true }), item("A-2", { q: false }), item("A-3", { q: null }), item("A-4")], "q")).toEqual({
      matching: 1,
      notMatching: 1,
      unanswered: 2,
      notMatchingKeys: ["A-2"],
    });
  });
});

describe("check-condition", () => {
  it("lists the conditions in force with their counts when no filter is given", async () => {
    const r = await runCheckCondition({ projectKey: "ops" }, fake().deps);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.inForce).toEqual([{ decisionId: "d-1", title: inForce.title, jql: "priority = Highest", matching: 1, notMatching: 1, unanswered: 1, notMatchingKeys: ["OPS-2"] }]);
    expect(r.checked).toBeNull();
    expect(r.quote).toBe("1 condition in force, counted over 3 open work items of OPS.");
  });

  it("counts a new filter and says when an equal one is already in force", async () => {
    const r = await runCheckCondition({ projectKey: "OPS", jql: "status = Review" }, fake().deps);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.checked).toEqual({ jql: "status = Review", errors: [], counts: { matching: 1, notMatching: 1, unanswered: 1, notMatchingKeys: ["OPS-2"] }, alreadyInForce: null });
    expect(r.quote).toContain("Nothing was saved.");
    const same = await runCheckCondition({ projectKey: "OPS", jql: "priority = Highest" }, fake().deps);
    expect(same.ok && same.checked?.alreadyInForce).toBe(inForce.title);
  });

  it("gives Jira's parse errors word for word and asks Jira to count nothing for that filter", async () => {
    const f = fake();
    const r = await runCheckCondition({ projectKey: "OPS", jql: "prioritee = Highest" }, f.deps);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.checked?.counts).toBeNull();
    expect(r.checked?.errors[0]).toContain("prioritee");
    expect(r.quote).toContain("Jira cannot run this filter");
    expect(f.calls.openItems).toEqual([[]]);
  });

  it("takes the project from the work item the chat was opened from, and refuses a key that is not one", async () => {
    const r = await runCheckCondition({ context: { jira: { issueKey: "OPS-7" } } }, fake().deps);
    expect(r.ok && r.projectKey).toBe("OPS");
    const bad = await runCheckCondition({ projectKey: "OPS) OR (1=1" }, fake().deps);
    expect(bad.ok).toBe(false);
    const none = await runCheckCondition({}, fake().deps);
    expect(!none.ok && none.error.code).toBe("bad_input");
  });

  it("says when only the first 100 open work items were counted", async () => {
    const r = await runCheckCondition({ projectKey: "OPS" }, fake({ openItems: async () => ({ items: [], capped: true }) }).deps);
    expect(r.ok && r.capped).toBe(true);
    expect(r.quote).toContain("(the first 100 only)");
  });
});

describe("draft-condition", () => {
  const ask = { projectKey: "OPS", title: "Reviewed work only", jql: "status = Review" };

  it("stores a draft that binds nothing", async () => {
    const f = fake();
    const r = await runDraftCondition(ask, "u-admin", f.deps);
    expect(r).toMatchObject({ ok: true, quote: DRAFT_STORED, supersedes: null });
    expect(f.drafts()).toHaveLength(1);
    // The actions are given no way to write a decision, so a draft cannot reach the rules or a verdict.
    expect(Object.keys(f.deps).sort()).toEqual(["getDecisions", "getDrafts", "isAdmin", "jqlErrors", "now", "openItems", "putDrafts"]);
  });

  it("refuses a caller who is not a project administrator, or whose role cannot be read", async () => {
    for (const isAdmin of [async () => false, async () => Promise.reject(new Error("403"))]) {
      const f = fake({ isAdmin });
      const r = await runDraftCondition(ask, "u-someone", f.deps);
      expect(!r.ok && r.error.code).toBe("not_allowed");
      expect(f.calls.putDrafts).toBe(0);
    }
    expect((await runDraftCondition(ask, null, fake().deps)).ok).toBe(false);
  });

  it("stores nothing when Jira cannot run the filter, or the shape is wrong", async () => {
    for (const bad of [{ jql: "prioritee = Highest" }, { jql: "priority = Highest ORDER BY created" }, { jql: "" }, { title: "" }, { jql: "priority = Highest", title: inForce.title }]) {
      const f = fake();
      const r = await runDraftCondition({ ...ask, ...bad }, "u-admin", f.deps);
      expect(r.ok, JSON.stringify(bad)).toBe(false);
      expect(f.calls.putDrafts).toBe(0);
    }
  });

  it("names only a decision in force as the one it replaces", async () => {
    const ok = await runDraftCondition({ ...ask, supersedes: "d-1" }, "u-admin", fake().deps);
    expect(ok.ok && ok.supersedes).toBe("d-1");
    const bad = await runDraftCondition({ ...ask, supersedes: "d-404" }, "u-admin", fake().deps);
    expect(bad.ok).toBe(false);
  });

  it("refuses the same draft twice and stops at the cap", async () => {
    const f = fake();
    expect((await runDraftCondition(ask, "u-admin", f.deps)).ok).toBe(true);
    expect((await runDraftCondition(ask, "u-admin", f.deps)).ok).toBe(false);
    const full = Array.from({ length: MAX_CONDITION_DRAFTS }, (_, i) => ({ id: `cd-${i}`, title: `t${i}`, jql: "x", supersedes: null, by: "u", at: NOW }));
    const g = fake({ getDrafts: async () => full });
    const r = await runDraftCondition(ask, "u-admin", g.deps);
    expect(!r.ok && r.error.message).toContain("Confirm or discard some first");
  });
});
