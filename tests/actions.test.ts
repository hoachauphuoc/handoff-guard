import { describe, expect, it } from "vitest";
import { callerAccountId, callerCloudId, runCheckHandoff, runGatherHandoffContext, runListBindingDecisions, runProposeDecisions, runReadDecisionSource, startLine, type Deps } from "../src/actions/core";
import { dismissProposal } from "../src/decisions/confirm";
import type { DecisionSource, Proposal } from "../src/decisions/types";
import { handoffFrom } from "../src/handoff/build";
import type { HandoffRecord } from "../src/handoff/types";
import { JiraReadError } from "../src/jira-error";
import { count } from "../src/plural";
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
  // Defaults throw, so the check and list actions fail loudly if they ever touch the proposal store.
  readSource: over.readSource ?? failing(new Error("must not read the source")),
  getProposals: over.getProposals ?? failing(new Error("must not read proposals")),
  putProposals: over.putProposals ?? failing(new Error("must not write proposals")),
  // Throws by default: check, list, source and propose prove they never call the graph.
  people: over.people ?? failing(new Error("must not read the graph")),
  now: () => "2026-11-12T00:00:00.000Z",
});

describe("check-handoff", () => {
  it("stored basis equals the panel check exactly", async () => {
    const out = await runCheckHandoff({ issueKey: "ops-1" }, "caller", deps());
    const expected = checkHandoff(handoffFrom(item, record, [decision]), [decision]);
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

  it("lists suggested fixes beside the verdict, never inside the quote", async () => {
    const late = { ...item, dueDate: "2027-01-05" };
    const out = await runCheckHandoff({ issueKey: "OPS-1" }, null, deps({ it: late }));
    expect(out.ok && out.fixes).toEqual(['Set the due date on or before 2026-12-31 ("Ship by 2026")']);
    if (out.ok) expect(out.quote).not.toContain("Set the due date");
    // Without a handoff there is no verdict, but the item can still be fixed.
    const none = await runCheckHandoff({ issueKey: "OPS-1" }, null, deps({ it: late, rec: null }));
    expect(none).toMatchObject({ verdict: null, fixes: ['Set the due date on or before 2026-12-31 ("Ship by 2026")'] });
    const fine = await runCheckHandoff({ issueKey: "OPS-1" }, null, deps());
    expect(fine.ok && fine.fixes).toEqual([]);
  });
});

describe("list-binding-decisions", () => {
  it("matches bindingDecisions and counts stored decisions", async () => {
    const other: Decision = { ...decision, id: "d2", scope: { kind: "project", projectKey: "ZZZ" } };
    const out = await runListBindingDecisions({ issueKey: "OPS-1" }, deps({ decisions: [decision, other] }));
    expect(out).toMatchObject({ ok: true, storedDecisionCount: 2 });
    if (out.ok) {
      expect(out.decisions.map((d) => d.id)).toEqual(bindingDecisions([decision, other], item).map((d) => d.id));
      expect(out.quote).toBe("1 decision binds OPS-1: Ship by 2026 (ledger demo)");
    }
  });

  it("says 2 decisions bind with the plural verb", async () => {
    const second: Decision = { ...decision, id: "d2", title: "Second" };
    const out = await runListBindingDecisions({ issueKey: "OPS-1" }, deps({ decisions: [decision, second] }));
    if (out.ok) expect(out.quote).toBe("2 decisions bind OPS-1: Ship by 2026 (ledger demo); Second (ledger demo)");
  });

  it("says plainly when nothing binds, and reports errors", async () => {
    const none = await runListBindingDecisions({ issueKey: "OPS-1" }, deps({ decisions: [] }));
    if (none.ok) expect(none.quote).toBe("No recorded decision binds OPS-1.");
    const bad = await runListBindingDecisions({}, deps());
    expect(bad).toMatchObject({ ok: false, error: { code: "bad_input" } });
    // Over MCP there is no work item context, so the message must say what a key looks like.
    expect(bad.ok === false && bad.error.message).toContain("PROJECT-123");
  });
});

const SOURCE: DecisionSource = {
  issueId: "10001",
  projectKey: "OPS",
  labels: ["launch"],
  parts: [{ from: "OPS-1 description", text: "Decision: all launch work needs the legal-reviewed label before 2026-12-15." }],
  truncated: false,
};
const good = {
  title: "Launch work needs legal review",
  scope: { kind: "label", label: "launch" },
  constraints: [{ kind: "labelRequired", label: "legal-reviewed" }],
  evidence: { quote: "all launch work needs the legal-reviewed label" },
};
const bad = { ...good, title: "Invented", evidence: { quote: "everything must be approved by the board" } };

// A store that records every write, and throws on the stores propose must never touch.
// Decisions are read (to skip repeats) but Deps has no way to write them.
function proposeDeps(decisions: Decision[] = []) {
  const writes: { issueId: string; proposals: Proposal[] }[] = [];
  let stored: Proposal[] = [];
  const d = deps({
    decisions,
    readSource: async () => SOURCE,
    getProposals: async () => stored,
    putProposals: async (issueId, proposals) => {
      stored = proposals;
      writes.push({ issueId, proposals });
    },
    getRecord: failing(new Error("must not touch records")),
  });
  return { d, writes, stored: () => stored };
}

describe("read-decision-source", () => {
  it("returns the parts and a quote, and maps errors", async () => {
    const out = await runReadDecisionSource({ issueKey: "OPS-1" }, deps({ readSource: async () => SOURCE }));
    expect(out).toMatchObject({ ok: true, source: "rules", issueKey: "OPS-1", truncated: false });
    if (out.ok) expect(out.parts).toEqual(SOURCE.parts);
    const consent = await runReadDecisionSource(
      { issueKey: "OPS-1" },
      deps({ readSource: failing(new JiraReadError("consent", "Allow access: x")) }),
    );
    expect(consent).toMatchObject({ ok: false, error: { code: "consent" } });
    expect(await runReadDecisionSource({}, deps())).toMatchObject({ ok: false, error: { code: "bad_input" } });
  });
});

describe("propose-decisions", () => {
  it("saves proposals only through putProposals and reports both lists", async () => {
    const { d, writes } = proposeDeps();
    const out = await runProposeDecisions({ issueKey: "OPS-1", candidates: JSON.stringify([good, bad]) }, d);
    expect(out).toMatchObject({ ok: true, source: "rules" });
    expect(writes).toHaveLength(1);
    expect(writes[0]?.issueId).toBe("10001");
    if (out.ok) {
      expect(out.proposed).toHaveLength(1);
      expect(out.rejected).toMatchObject([{ index: 1, reason: "evidence_not_in_source" }]);
      expect(out.rejected[0]?.message).toContain("word for word");
      expect(out.quote).toBe(
        "Handoff Guard saved 1 proposed decision for OPS-1 and rejected 1 (#2: evidence.quote was not found word for word in the work item text; copy it exactly from read-decision-source.). Proposed decisions do not bind anything until a person confirms them in the Handoff Guard panel.",
      );
    }
  });

  it("leaves identical stored state when run twice", async () => {
    const { d, stored } = proposeDeps();
    const input = { issueKey: "OPS-1", candidates: JSON.stringify([good]) };
    await runProposeDecisions(input, d);
    const first = JSON.stringify(stored());
    await runProposeDecisions(input, { ...d, now: () => "2027-01-01T00:00:00.000Z" });
    expect(JSON.stringify(stored())).toBe(first);
  });

  it("writes nothing when every candidate is rejected", async () => {
    const { d, writes } = proposeDeps();
    const out = await runProposeDecisions({ issueKey: "OPS-1", candidates: JSON.stringify([bad]) }, d);
    expect(out).toMatchObject({ ok: true });
    expect(writes).toEqual([]);
  });

  it("rejects bad JSON, a non-string and over-long input with bad_input and no work", async () => {
    const { d, writes } = proposeDeps();
    const boom = { ...d, readSource: failing(new Error("must not read")) };
    for (const candidates of ["not json", [good], undefined, "[" + " ".repeat(20_000) + "]"]) {
      const out = await runProposeDecisions({ issueKey: "OPS-1", candidates }, boom);
      expect(out).toMatchObject({ ok: false, error: { code: "bad_input" } });
    }
    expect(writes).toEqual([]);
  });

  it("never writes decisions or handoff records", async () => {
    // proposeDeps makes getRecord throw; the Deps type has no write for decisions or records at all.
    const { d } = proposeDeps();
    const out = await runProposeDecisions({ issueKey: "OPS-1", candidates: JSON.stringify([good]) }, d);
    expect(out.ok).toBe(true);
  });

  it("rejects a candidate that repeats a confirmed decision, whatever its title", async () => {
    const confirmed: Decision = {
      id: "d-x",
      title: "Legal review for launches",
      status: "decided",
      source: { kind: "jira", ref: "OPS-1" },
      scope: { kind: "label", label: "Launch" },
      constraints: [{ kind: "labelRequired", label: "Legal-Reviewed" }],
    };
    const { d, writes } = proposeDeps([confirmed]);
    const out = await runProposeDecisions({ issueKey: "OPS-1", candidates: JSON.stringify([good]) }, d);
    expect(out).toMatchObject({ ok: true, proposed: [], rejected: [{ index: 0, reason: "already_decided" }] });
    expect(writes).toEqual([]);
    // A superseded decision no longer binds, so proposing the rule again is allowed.
    const old = proposeDeps([{ ...confirmed, status: "superseded" }]);
    expect(await runProposeDecisions({ issueKey: "OPS-1", candidates: JSON.stringify([good]) }, old.d)).toMatchObject({ proposed: [{ title: good.title }] });
  });
});

describe("check-handoff and list-binding stay read-only", () => {
  it("never touch the proposal store (the default deps throw if they do)", async () => {
    expect(await runCheckHandoff({ issueKey: "OPS-1" }, null, deps())).toMatchObject({ ok: true });
    expect(await runListBindingDecisions({ issueKey: "OPS-1" }, deps())).toMatchObject({ ok: true });
  });
});

describe("propose-decisions scope filling (MOBL-53 case)", () => {
  const SRC: DecisionSource = {
    issueId: "10053",
    projectKey: "MOBL",
    labels: [],
    parts: [{ from: "MOBL-53 description", text: "Decision: all launch work needs the legal-reviewed label." }],
    truncated: false,
  };
  const cand = (scope: unknown) => ({
    title: "Launch work needs legal review",
    scope,
    constraints: [{ kind: "labelRequired", label: "legal-reviewed" }],
    evidence: { quote: "all launch work needs the legal-reviewed label" },
  });
  const run = (scope: unknown) => {
    const d = deps({
      readSource: async () => SRC,
      getProposals: async () => [],
      putProposals: async () => {},
    });
    return runProposeDecisions({ issueKey: "MOBL-53", candidates: JSON.stringify([cand(scope)]) }, d);
  };

  it("fills a missing projectKey from the item", async () => {
    const out = await run({ kind: "project" });
    expect(out.ok && out.proposed[0]?.scope).toEqual({ kind: "project", projectKey: "MOBL" });
  });

  it("fills a missing workItem key from the item", async () => {
    const out = await run({ kind: "workItem" });
    expect(out.ok && out.proposed[0]?.scope).toEqual({ kind: "workItem", key: "MOBL-53" });
  });

  it("rejects a label the item does not carry, with a readable reason", async () => {
    const out = await run({ kind: "label", label: "launch" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.proposed).toEqual([]);
      expect(out.rejected[0]).toMatchObject({ index: 0, reason: "bad_scope" });
      expect(out.rejected[0]?.message).toContain("label this work item already has");
      expect(out.quote).toContain("rejected 1 (#1:");
    }
  });

  it("still rejects another project or another work item", async () => {
    for (const scope of [{ kind: "project", projectKey: "OPS" }, { kind: "workItem", key: "OPS-1" }]) {
      const out = await run(scope);
      expect(out.ok && out.rejected[0]?.reason).toBe("bad_scope");
    }
  });
});

describe("count", () => {
  it("uses the singular only for 1", () => {
    expect(count(0, "stored decision")).toBe("0 stored decisions");
    expect(count(1, "stored decision")).toBe("1 stored decision");
    expect(count(2, "stored decision")).toBe("2 stored decisions");
    expect(count(2, "match", "matches")).toBe("2 matches");
  });

  it("read-source and propose quotes follow it", async () => {
    const one = await runReadDecisionSource({ issueKey: "OPS-1" }, deps({ readSource: async () => SOURCE }));
    if (one.ok) expect(one.quote).toContain("read 1 text part of OPS-1");
    const two = await runReadDecisionSource(
      { issueKey: "OPS-1" },
      deps({ readSource: async () => ({ ...SOURCE, parts: [...SOURCE.parts, ...SOURCE.parts] }) }),
    );
    if (two.ok) expect(two.quote).toContain("read 2 text parts of OPS-1");
    const { d } = proposeDeps();
    const second = { ...good, title: "Another", scope: { kind: "project" }, evidence: { quote: "Decision: all launch work needs the legal-reviewed label" } };
    const out = await runProposeDecisions({ issueKey: "OPS-1", candidates: JSON.stringify([good, second]) }, d);
    if (out.ok) expect(out.quote).toContain("saved 2 proposed decisions for OPS-1");
  });
});

describe("dismissing a proposal", () => {
  it("deletes it, and a later propose brings it back with a new proposedAt", async () => {
    let stored: Proposal[] = [];
    const d = deps({
      readSource: async () => SOURCE,
      getProposals: async () => stored,
      putProposals: async (_id, p) => {
        stored = p;
      },
    });
    const input = { issueKey: "OPS-1", candidates: JSON.stringify([good]) };
    await runProposeDecisions(input, d);
    expect(stored).toHaveLength(1);
    const first = stored[0] as Proposal;
    stored = dismissProposal(stored, first.id);
    expect(stored).toEqual([]);
    await runProposeDecisions(input, { ...d, now: () => "2027-01-01T00:00:00.000Z" });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: first.id, proposedAt: "2027-01-01T00:00:00.000Z" });
    expect(stored[0]?.proposedAt).not.toBe(first.proposedAt);
  });

  it("an unknown id changes nothing, and dismissProposal takes no decisions", () => {
    const p = { id: "p-1" } as Proposal;
    expect(dismissProposal([p], "p-other")).toEqual([p]);
    expect(dismissProposal.length).toBe(2);
  });
});

describe("callerCloudId", () => {
  const SITE = "ari:cloud:jira::site/0a1b2c3d-1111-2222-3333-444455556666";
  it("prefers payload.context.cloudId, then context.cloudId, then the install context", () => {
    expect(callerCloudId({ context: { cloudId: "p" } }, { cloudId: "c", installContext: SITE })).toBe("p");
    expect(callerCloudId({}, { cloudId: "c", installContext: SITE })).toBe("c");
    expect(callerCloudId({}, { installContext: SITE })).toBe("0a1b2c3d-1111-2222-3333-444455556666");
  });

  it("never guesses", () => {
    expect(callerCloudId({}, undefined)).toBeNull();
    expect(callerCloudId({ context: { cloudId: " " } }, { installContext: "ari:cloud:jira::site/short" })).toBeNull();
    expect(callerCloudId({}, { installContext: "ari:cloud:confluence::site/0a1b2c3d-1111-2222-3333-444455556666" })).toBeNull();
  });
});

describe("callerAccountId", () => {
  it("prefers payload.context.accountId and falls back to the second argument", () => {
    expect(callerAccountId({ context: { accountId: "a1" } }, { accountId: "a2" })).toBe("a1");
    expect(callerAccountId({}, { accountId: "a2" })).toBe("a2");
    expect(callerAccountId(undefined, undefined)).toBeNull();
  });
});

describe("gather-handoff-context", () => {
  const comment = (id: number, text = "c") => ({ from: `OPS-1 comment ${id}`, text });
  const src = (parts: DecisionSource["parts"]): DecisionSource => ({ ...SOURCE, parts });
  const graph = (r: Awaited<ReturnType<Deps["people"]>>) => async () => r;
  const gather = (over: Parameters<typeof deps>[0] = {}, payload: unknown = { issueKey: "OPS-1" }) =>
    runGatherHandoffContext(
      payload,
      "caller",
      deps({ readSource: async () => SOURCE, people: graph({ status: "ok", sharedWith: ["a"], mentioned: ["b"] }), ...over }),
    );

  it("carries the very same check object check-handoff returns", async () => {
    const out = await gather();
    const direct = await runCheckHandoff({ issueKey: "OPS-1" }, "caller", deps());
    expect(out.ok && out.check).toEqual(direct);
    expect(out).toMatchObject({ ok: true, source: "rules", schema: "handoff-guard/handoff-context@1" });
  });

  it("joins binding decisions with their constraints", async () => {
    const out = await gather();
    if (out.ok) {
      expect(out.binding).toEqual([
        { id: "d1", title: "Ship by 2026", source: decision.source, constraints: decision.constraints, acknowledged: true },
      ]);
    }
  });

  it("keeps at most 10 comments of 600 characters, newest first, and never the description", async () => {
    const parts = [
      { from: "OPS-1 description", text: "D".repeat(3000) },
      ...Array.from({ length: 12 }, (_, i) => comment(100 - i, "x".repeat(700))),
    ];
    const out = await gather({ readSource: async () => src(parts), it: { ...item, description: "D".repeat(3000) } });
    if (!out.ok) throw new Error("expected ok");
    expect(out.comments).toHaveLength(10);
    expect(out.comments[0]?.from).toBe("OPS-1 comment 100");
    expect(out.comments.every((c) => c.text.length === 600 && c.from.includes(" comment "))).toBe(true);
    expect(out.item.description).toHaveLength(2000);
    expect(out.item.descriptionTruncated).toBe(true);
    expect(out.quote).toContain("10 comments read.");
  });

  it("does not flag a short description as cut, and says 1 comment", async () => {
    const out = await gather({ readSource: async () => src([comment(1)]) });
    if (!out.ok) throw new Error("expected ok");
    expect(out.item.descriptionTruncated).toBe(false);
    expect(out.quote).toContain("1 comment read.");
  });

  it("starts the quote with the check quote and ends with the advisory sentence", async () => {
    const out = await gather();
    if (!out.ok) throw new Error("expected ok");
    expect(out.quote.startsWith(out.check.quote + " Handoff Guard gathered context for OPS-1: ")).toBe(true);
    expect(out.quote).toContain("Teamwork Graph: 1 shared with, 1 mentioned.");
    expect(out.quote.endsWith("A brief written from this is advisory and is not stored.")).toBe(true);
  });

  it("reports each people status with its own note", async () => {
    const asked = await gather();
    expect(asked.ok && asked.people).toMatchObject({ source: "Teamwork Graph", status: "ok", sharedWith: ["a"], mentioned: ["b"] });
    expect(asked.ok && asked.people.note).toContain("Shared with: direct shares in the last 90 days.");
    const none = await gather({ people: graph({ status: "nothing", sharedWith: [], mentioned: [] }) });
    expect(none.ok && none.people.note).toBe(
      "Teamwork Graph returned nothing. That can mean no permission or nobody is connected; it is not a fact about the work item.",
    );
    if (none.ok) expect(none.quote).toContain("Teamwork Graph: returned nothing.");
    const noQuery = await gather({ people: graph({ status: "not_configured", reason: "no_query", sharedWith: [], mentioned: [] }) });
    expect(noQuery.ok && noQuery.people.note).toBe("Teamwork Graph was not asked: no saved query is registered for this app.");
    const noSite = await gather({ people: graph({ status: "not_configured", reason: "no_site", sharedWith: [], mentioned: [] }) });
    expect(noSite.ok && noSite.people.note).toBe("Teamwork Graph was not asked: the site id is unknown.");
    if (noSite.ok) expect(noSite.quote).toContain("Teamwork Graph: was not asked.");
  });

  it("turns a failing graph call into nothing, not an error", async () => {
    const out = await gather({ people: failing(new Error("403")) });
    expect(out).toMatchObject({ ok: true, people: { status: "nothing", sharedWith: [], mentioned: [] } });
    expect(JSON.stringify(out)).not.toContain("403");
  });

  it("people never change the check", async () => {
    const a = await gather({ people: graph({ status: "ok", sharedWith: ["x", "y"], mentioned: [] }) });
    const b = await gather({ people: graph({ status: "nothing", sharedWith: [], mentioned: [] }) });
    expect(a.ok && b.ok && a.check).toEqual(b.ok && b.check);
  });

  it("returns the check error unchanged", async () => {
    const out = await gather({ readItem: failing(new JiraReadError("consent", "Allow access: x")) });
    expect(out).toMatchObject({ ok: false, source: "rules", issueKey: "OPS-1", error: { code: "consent", message: "Allow access: x" } });
    expect(await gather({}, {})).toMatchObject({ ok: false, error: { code: "bad_input" } });
  });

  it("is the only action that asks the graph", async () => {
    let asked = 0;
    const spy = {
      people: async () => {
        asked++;
        return { status: "ok" as const, sharedWith: [], mentioned: [] };
      },
    };
    const { d } = proposeDeps();
    await runCheckHandoff({ issueKey: "OPS-1" }, null, deps(spy));
    await runListBindingDecisions({ issueKey: "OPS-1" }, deps(spy));
    await runReadDecisionSource({ issueKey: "OPS-1" }, deps({ ...spy, readSource: async () => SOURCE }));
    await runProposeDecisions({ issueKey: "OPS-1", candidates: JSON.stringify([good]) }, { ...d, ...spy });
    expect(asked).toBe(0);
    await gather(spy);
    expect(asked).toBe(1);
  });
});

describe("check-handoff fixes", () => {
  it("are a sibling: quote, verdict and findings equal the plain rule check", async () => {
    const late = { ...item, dueDate: "2027-03-01" };
    const out = await runCheckHandoff({ issueKey: "OPS-1" }, null, deps({ it: late }));
    const expected = checkHandoff(handoffFrom(late, record, [decision]), [decision]);
    if (!out.ok) throw new Error("expected ok");
    expect(out.fixes).toEqual(['Set the due date on or before 2026-12-31 ("Ship by 2026")']);
    expect(out.verdict).toBe(expected.verdict);
    expect(out.findings).toEqual(expected.findings);
    expect(out.quote).toBe(`Handoff Guard rule check for OPS-1: Blocked. Findings: ${expected.findings.map((f) => f.message).join(" ")}`);
    expect(out.quote).not.toContain("Set the due date");
  });
});

describe("startLine", () => {
  it("is fixed text chosen by the verdict, and is not part of the quote", () => {
    expect(startLine("clear")).toBe("The rule check says Clear, so I may start.");
    expect(startLine("needs_info")).toBe("I will not start this work item: the rule check says Needs info.");
    expect(startLine("blocked")).toBe("I will not start this work item: the rule check says Blocked.");
    expect(startLine(null)).toBe("No handoff is prepared, so there is no verdict and I will not start this work item.");
  });
});
