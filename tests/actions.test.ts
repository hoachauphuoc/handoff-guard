import { describe, expect, it } from "vitest";
import { runCheckHandoff, runListBindingDecisions, type Deps } from "../src/actions/core";
import { handoffFrom } from "../src/handoff/build";
import type { HandoffRecord } from "../src/handoff/types";
import { JiraReadError } from "../src/jira-error";
import { bindingDecisions, checkHandoff } from "../src/rules/checkHandoff";
import type { Decision, WorkItem } from "../src/rules/types";

const item: WorkItem = {
  key: "OPS-1",
  projectKey: "OPS",
  summary: "Launch",
  description: "Body",
  labels: [],
  components: [],
  dueDate: "2026-12-10",
  assigneeId: "a",
};
const decision: Decision = {
  id: "d1",
  title: "Ship by 2026",
  status: "decided",
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-31" }],
};
const record: HandoffRecord = { fromId: "from", toId: "to", acknowledged: ["d1"], preparedAt: "t", acknowledgedAt: {} };

const failing = (e: unknown) => async (): Promise<never> => {
  throw e;
};

const deps = (over: Partial<Deps> & { rec?: HandoffRecord | null; decisions?: Decision[]; it?: WorkItem } = {}): Deps => ({
  readItem: over.readItem ?? (async () => ({ item: over.it ?? item, issueId: "10001" })),
  getDecisions: over.getDecisions ?? (async () => over.decisions ?? [decision]),
  getRecord: over.getRecord ?? (async () => (over.rec === undefined ? record : over.rec)),
});

describe("check-handoff", () => {
  it("stored basis equals the panel check exactly", async () => {
    const out = await runCheckHandoff({ issueKey: "ops-1" }, "caller", deps());
    const expected = checkHandoff(handoffFrom(item, record), [decision]);
    expect(out).toMatchObject({ ok: true, basis: "stored", verdict: expected.verdict, senderId: "from", receiverId: "to" });
    if (out.ok) expect(out.findings).toEqual(expected.findings);
  });

  it("keeps acknowledgements for the stored receiver and drops them for another", async () => {
    const same = await runCheckHandoff({ issueKey: "OPS-1", receiverAccountId: "to" }, "caller", deps());
    expect(same).toMatchObject({ basis: "stored", verdict: "clear" });
    const other = await runCheckHandoff({ issueKey: "OPS-1", receiverAccountId: "someone" }, "caller", deps());
    expect(other).toMatchObject({ basis: "preview", verdict: "needs_info", senderId: "from", receiverId: "someone" });
    if (other.ok) expect(other.binding.every((b) => !b.acknowledged)).toBe(true);
  });

  it("previews with the caller as sender when no record exists", async () => {
    const out = await runCheckHandoff({ issueKey: "OPS-1", receiverAccountId: "r" }, "caller", deps({ rec: null }));
    expect(out).toMatchObject({ basis: "preview", senderId: "caller", receiverId: "r" });
  });

  it("gives no verdict without a record or receiver", async () => {
    const out = await runCheckHandoff({ issueKey: "OPS-1" }, "caller", deps({ rec: null }));
    expect(out).toMatchObject({ ok: true, basis: "none", verdict: null, verdictText: null, findings: [] });
    if (out.ok) {
      expect(out.quote).toBe(
        "Handoff Guard rule check for OPS-1: no handoff is prepared, so there is no verdict. Prepare one in the Handoff Guard panel or name a receiver.",
      );
    }
  });

  it("falls back to the context key, trimming and uppercasing", async () => {
    const out = await runCheckHandoff({ context: { jira: { issueKey: " ops-1 " } } }, null, deps());
    expect(out).toMatchObject({ ok: true, issueKey: "OPS-1" });
  });

  it("rejects a missing or malformed key without reading Jira", async () => {
    const boom = deps({ readItem: failing(new Error("must not read")) });
    for (const payload of [undefined, {}, { issueKey: "nope" }, { issueKey: "OPS-1; DROP" }]) {
      const out = await runCheckHandoff(payload, null, boom);
      expect(out).toMatchObject({ ok: false, source: "rules", error: { code: "bad_input" } });
      if (!out.ok) expect(out.quote.startsWith("Handoff Guard could not check ")).toBe(true);
    }
  });

  it("maps Jira read errors and hides unknown ones", async () => {
    for (const code of ["consent", "not_found", "jira_error"] as const) {
      const out = await runCheckHandoff({ issueKey: "OPS-1" }, null, deps({ readItem: failing(new JiraReadError(code, `msg ${code}`)) }));
      expect(out).toMatchObject({ ok: false, issueKey: "OPS-1", error: { code, message: `msg ${code}` } });
    }
    const out = await runCheckHandoff({ issueKey: "OPS-1" }, null, deps({ getDecisions: failing(new Error("secret detail")) }));
    expect(out).toMatchObject({ ok: false, error: { code: "internal" } });
    expect(JSON.stringify(out)).not.toContain("secret detail");
  });

  it("a clear verdict carries no finding and says so in the quote", async () => {
    const out = await runCheckHandoff({ issueKey: "OPS-1" }, null, deps());
    expect(out).toMatchObject({ verdict: "clear", verdictText: "Clear", findings: [] });
    if (out.ok) expect(out.quote).toBe("Handoff Guard rule check for OPS-1: Clear. No findings.");
  });

  it("quote contains the verdict text and every finding message", async () => {
    const out = await runCheckHandoff({ issueKey: "OPS-1" }, null, deps({ it: { ...item, dueDate: "2027-01-05", assigneeId: "to" } }));
    expect(out.ok && out.verdictText).toBe("Blocked");
    if (out.ok) {
      expect(out.quote).toContain(": Blocked. Findings: ");
      for (const f of out.findings) expect(out.quote).toContain(f.message);
    }
  });
});

describe("list-binding-decisions", () => {
  it("matches bindingDecisions and counts stored decisions", async () => {
    const other: Decision = { ...decision, id: "d2", scope: { kind: "project", projectKey: "ZZZ" } };
    const out = await runListBindingDecisions({ issueKey: "OPS-1" }, deps({ decisions: [decision, other] }));
    expect(out).toMatchObject({ ok: true, storedDecisionCount: 2 });
    if (out.ok) {
      expect(out.decisions.map((d) => d.id)).toEqual(bindingDecisions([decision, other], item).map((d) => d.id));
      expect(out.quote).toBe("1 decisions bind OPS-1: Ship by 2026 (ledger demo)");
    }
  });

  it("says plainly when nothing binds, and reports errors", async () => {
    const none = await runListBindingDecisions({ issueKey: "OPS-1" }, deps({ decisions: [] }));
    if (none.ok) expect(none.quote).toBe("No recorded decision binds OPS-1.");
    const bad = await runListBindingDecisions({}, deps());
    expect(bad).toMatchObject({ ok: false, error: { code: "bad_input" } });
  });
});
