/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { confirmProposal } from "../src/decisions/confirm";
import { canSupersede, reachCovers, relate, splitOverlap, supersede } from "../src/decisions/supersede";
import type { Proposal } from "../src/decisions/types";
import { validateCandidates } from "../src/decisions/validate";
import { bindingDecisions, checkHandoff } from "../src/rules/checkHandoff";
import type { Constraint, Decision, DecisionScope, WorkItem } from "../src/rules/types";

const project: DecisionScope = { kind: "project", projectKey: "MOBL" };
const one: DecisionScope = { kind: "workItem", key: "MOBL-53" };
const decision = (over: Partial<Decision> = {}): Decision => ({
  id: "d1",
  title: "No legacy email",
  status: "decided",
  source: { kind: "jira", ref: "MOBL-53" },
  scope: one,
  constraints: [{ kind: "componentForbidden", component: "legacy-email" }],
  ...over,
});
const NOW = "2026-11-12T00:00:00.000Z";
const item: WorkItem = { key: "MOBL-53", projectKey: "MOBL", summary: "s", description: "d", labels: [], components: ["legacy-email"], dueDate: "2026-12-01", assigneeId: null };

describe("reachCovers", () => {
  it("lets a project cover its own work items, and nothing else beyond equality", () => {
    expect(reachCovers(project, one)).toBe(true);
    expect(reachCovers(one, project)).toBe(false);
    expect(reachCovers(project, { kind: "workItem", key: "OTHER-1" })).toBe(false);
    expect(reachCovers({ kind: "label", label: "x" }, one)).toBe(false);
    expect(reachCovers({ kind: "label", label: "X " }, { kind: "label", label: "x" })).toBe(true);
  });

  it("keeps label scopes of different projects apart; a site-wide one covers a bound one, not the reverse", () => {
    const wide: DecisionScope = { kind: "label", label: "x" };
    const a: DecisionScope = { kind: "label", label: "X", projectKey: "A" };
    const b: DecisionScope = { kind: "label", label: "x", projectKey: "B" };
    expect(reachCovers(a, b)).toBe(false);
    expect(reachCovers(a, { ...a, label: "x", projectKey: "a " })).toBe(true);
    expect(reachCovers(wide, a)).toBe(true);
    expect(reachCovers(a, wide)).toBe(false);
    expect(reachCovers(wide, { kind: "label", label: "y", projectKey: "A" })).toBe(false);
  });

  it("does not let a decision bound to another project make a label candidate redundant", () => {
    const req: Constraint[] = [{ kind: "labelRequired", label: "legal" }];
    const inA = decision({ scope: { kind: "label", label: "x", projectKey: "A" }, constraints: req });
    expect(relate([inA], { kind: "label", label: "x", projectKey: "B" }, req)).toBeNull();
    expect(relate([inA], { kind: "label", label: "x", projectKey: "A" }, req)).toMatchObject({ kind: "already_decided" });
    const legacy = decision({ scope: { kind: "label", label: "x" }, constraints: req });
    expect(relate([legacy], { kind: "label", label: "x", projectKey: "B" }, req)).toMatchObject({ kind: "already_decided" });
    expect(relate([inA], { kind: "label", label: "x" }, req)).toMatchObject({ kind: "supersedes" });
  });
});

describe("relate", () => {
  const forbid: Constraint[] = [{ kind: "componentForbidden", component: "Legacy-Email" }];

  it("calls a candidate already decided when equal or wider reach already sets its constraints", () => {
    expect(relate([decision({ scope: project })], one, forbid)?.kind).toBe("already_decided");
    expect(relate([decision({ scope: one })], one, forbid)?.kind).toBe("already_decided");
    const due = decision({ scope: project, constraints: [{ kind: "dueNotAfter", date: "2026-12-01" }] });
    expect(relate([due], one, [{ kind: "dueNotAfter", date: "2026-12-15" }])?.kind).toBe("already_decided");
  });

  it("offers superseding when the candidate widens an existing decision (the MOBL-53 near-twin)", () => {
    const r = relate([decision()], project, forbid);
    expect(r?.kind).toBe("supersedes");
    expect(r?.kind === "supersedes" && r.old.map((d) => d.id)).toEqual(["d1"]);
  });

  it("offers superseding when a date limit moves for the same reach, earlier or later, or for the opposite rule", () => {
    const due = decision({ scope: project, constraints: [{ kind: "dueNotAfter", date: "2026-12-15" }] });
    expect(relate([due], project, [{ kind: "dueNotAfter", date: "2026-12-31" }])?.kind).toBe("supersedes");
    expect(relate([due], project, [{ kind: "dueNotAfter", date: "2026-12-15" }])?.kind).toBe("already_decided");
    expect(relate([due], one, [{ kind: "dueNotAfter", date: "2026-12-31" }])?.kind).toBe("already_decided");
    expect(relate([due], project, [{ kind: "dueNotAfter", date: "2026-12-01" }])?.kind).toBe("supersedes");
    const req = decision({ scope: project, constraints: [{ kind: "labelRequired", label: "x" }] });
    expect(relate([req], project, [{ kind: "labelForbidden", label: "X" }])?.kind).toBe("supersedes");
  });

  it("never lets a decision with no constraints be superseded as redundant", () => {
    expect(relate([decision({ constraints: [] })], project, [{ kind: "labelRequired", label: "legal" }])).toBeNull();
  });

  it("is null for unrelated rules and ignores superseded decisions", () => {
    expect(relate([decision()], project, [{ kind: "labelRequired", label: "legal" }])).toBeNull();
    expect(relate([decision({ scope: project, status: "superseded" })], one, forbid)).toBeNull();
  });
});

describe("validateCandidates with relations", () => {
  const parts = [{ from: "MOBL-53 description", text: "Decision: no legacy-email component for any campaign work." }];
  const cand = (scope: unknown) => ({
    title: "t",
    scope,
    constraints: [{ kind: "componentForbidden", component: "legacy-email" }],
    evidence: { quote: "no legacy-email component for any campaign work" },
  });
  const ctx = (stored: Decision[]) => ({ issueKey: "MOBL-53", projectKey: "MOBL", labels: [], stored });

  it("rejects a candidate covered by a project decision, keeps one that widens a work item decision", () => {
    const covered = validateCandidates([cand({ kind: "workItem", key: "MOBL-53" })], parts, ctx([decision({ scope: project })]), NOW);
    expect(covered.rejected[0]?.reason).toBe("already_decided");
    const out = validateCandidates([cand({ kind: "project", projectKey: "MOBL" })], parts, ctx([decision()]), NOW);
    expect(out.rejected).toEqual([]);
    expect(out.kept).toHaveLength(1);
  });
});

describe("supersede and confirm", () => {
  const proposal: Proposal = {
    id: "p-1",
    title: "No legacy email anywhere",
    scope: project,
    constraints: [{ kind: "componentForbidden", component: "legacy-email" }],
    evidence: { quote: "no legacy-email component for any campaign work", from: "MOBL-53 description" },
    proposedAt: NOW,
  };

  it("confirming alone keeps both in force; confirm and supersede retires the old one and records when and by what", () => {
    const plain = confirmProposal([proposal], [decision()], "p-1", "u", NOW);
    if (!plain.ok) throw new Error("expected ok");
    expect(plain.decisions.map((d) => d.status)).toEqual(["decided", "decided"]);
    const out = confirmProposal([proposal], [decision()], "p-1", "u", NOW, true);
    if (!out.ok) throw new Error("expected ok");
    const [old, fresh] = out.decisions;
    expect(old).toMatchObject({ id: "d1", status: "superseded", supersededAt: NOW, supersededBy: fresh?.id });
    expect(fresh?.status).toBe("decided");
  });

  it("a superseded decision binds nothing and stops contradicting", () => {
    const before = checkHandoff({ item, fromId: "a", toId: "b", acknowledged: ["d1"] }, [decision()]);
    expect(before.verdict).toBe("blocked");
    const after = supersede([decision()], ["d1"], NOW);
    expect(bindingDecisions(after, item)).toEqual([]);
    expect(checkHandoff({ item, fromId: "a", toId: "b", acknowledged: [] }, after).findings.map((f) => f.rule)).toEqual([]);
  });

  it("retires only decisions that are in force, and leaves others as they were", () => {
    const gone = decision({ id: "d2", status: "superseded", supersededAt: "t0" });
    const out = supersede([decision(), gone], ["d1", "d2", "nope"], NOW);
    expect(out[0]).toMatchObject({ status: "superseded", supersededAt: NOW });
    expect(out[0]).not.toHaveProperty("supersededBy");
    expect(out[1]).toBe(gone);
  });

  it("retires a decision the confirming person confirmed, and one with no recorded confirmer", () => {
    const mine = decision({ confirmedBy: "u" });
    const out = confirmProposal([proposal], [mine, decision({ id: "d2" })], "p-1", "u", NOW, true);
    if (!out.ok) throw new Error("expected ok");
    expect(out.decisions.map((d) => d.status)).toEqual(["superseded", "superseded", "decided"]);
  });

  it("leaves a decision someone else confirmed in force while still confirming the new one", () => {
    const theirs = decision({ confirmedBy: "v" });
    const mine = decision({ id: "d2", confirmedBy: "u" });
    const out = confirmProposal([proposal], [theirs, mine], "p-1", "u", NOW, true);
    if (!out.ok) throw new Error("expected ok");
    expect(out.decisions.map((d) => [d.id, d.status])).toEqual([["d1", "decided"], ["d2", "superseded"], [out.decisions[2]!.id, "decided"]]);
    expect(out.proposals).toEqual([]);
  });

  it("splits what the viewer may retire from what only its confirmer may", () => {
    const theirs = decision({ confirmedBy: "v" });
    const mine = decision({ id: "d2", confirmedBy: "u" });
    const out = splitOverlap([theirs, mine], proposal.scope, proposal.constraints, "u");
    expect(out.retirable.map((d) => d.id)).toEqual(["d2"]);
    expect(out.kept.map((d) => d.id)).toEqual(["d1"]);
    expect(splitOverlap([theirs], { kind: "label", label: "zzz" }, [{ kind: "labelRequired", label: "q" }], "u")).toEqual({ retirable: [], kept: [] });
  });

  it("ignores a retire request the stored decisions do not support", () => {
    const other = { ...proposal, constraints: [{ kind: "labelRequired" as const, label: "unrelated" }] };
    const out = confirmProposal([other], [decision()], "p-1", "u", NOW, true);
    if (!out.ok) throw new Error("expected ok");
    expect(out.decisions.map((d) => d.status)).toEqual(["decided", "decided"]);
  });
});

describe("canSupersede", () => {
  it("lets only the person who confirmed a decision retire it", () => {
    const d = decision({ confirmedBy: "alice" });
    expect(canSupersede(d, "alice")).toBe(true);
    expect(canSupersede(d, "bob")).toBe(false);
  });

  it("lets anyone signed in retire a decision with no recorded confirmer", () => {
    expect(canSupersede(decision(), "bob")).toBe(true);
  });
});
