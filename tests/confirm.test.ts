/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { confirmProposal, dismissProposal } from "../src/decisions/confirm";
import type { Proposal } from "../src/decisions/types";
import { bindingDecisions, checkHandoff } from "../src/rules/checkHandoff";
import type { Decision, WorkItem } from "../src/rules/types";
import rulesSource from "../src/rules/checkHandoff?raw";

const NOW = "2026-11-12T00:00:00.000Z";
const proposal: Proposal = {
  id: "p-1234abcd",
  title: "Launch work needs legal review",
  scope: { kind: "label", label: "launch" },
  constraints: [{ kind: "labelRequired", label: "legal-reviewed" }],
  evidence: { quote: "all launch work needs the legal-reviewed label", from: "OPS-1 comment 10001" },
  proposedAt: NOW,
};
const item: WorkItem = {
  key: "OPS-1",
  projectKey: "OPS",
  summary: "s",
  description: "d",
  labels: ["launch"],
  components: [],
  dueDate: "2026-12-01",
  assigneeId: null,
};
const other: Decision = {
  id: "d-other",
  title: "Other",
  status: "decided",
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [],
};

describe("proposals", () => {
  it("cannot reach the rules: the types differ and the rules never import the decisions folder", () => {
    // A Proposal has no status or source, so the compiler refuses it as a Decision.
    // @ts-expect-error a Proposal is not a Decision
    const asDecision: Decision[] = [proposal];
    expect(asDecision).toHaveLength(1);
    expect(rulesSource).not.toMatch(/decisions\//);
    expect(rulesSource).not.toMatch(/Proposal/);
  });
});

describe("confirm and dismiss", () => {
  it("makes a decision that binds, and removes the proposal", () => {
    const out = confirmProposal([proposal], [other], proposal.id, "me", NOW);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.proposals).toEqual([]);
    const made = out.decisions.find((d) => d.id !== "d-other")!;
    expect(made).toMatchObject({ status: "decided", title: proposal.title, confirmedBy: "me", confirmedAt: NOW });
    expect(made.source).toEqual({ kind: "jira", ref: "OPS-1 comment 10001" });
    expect(bindingDecisions(out.decisions, item).map((d) => d.id)).toContain(made.id);
  });

  it("uses the work item key as source for a description", () => {
    const p = { ...proposal, evidence: { ...proposal.evidence, from: "OPS-1 description" } };
    const out = confirmProposal([p], [], p.id, "me", NOW);
    expect(out.ok && out.decisions[0]?.source).toEqual({ kind: "jira", ref: "OPS-1" });
  });

  it("confirming twice changes nothing", () => {
    const first = confirmProposal([proposal], [other], proposal.id, "me", NOW);
    const again = confirmProposal([proposal], first.ok ? first.decisions : [], proposal.id, "me", NOW);
    expect(again.ok && first.ok && again.decisions).toEqual(first.ok && first.decisions);
    expect(first.ok && confirmProposal(first.proposals, first.decisions, proposal.id, "me", NOW)).toEqual({ ok: false, reason: "not_found" });
  });

  it("a reworded twin of a confirmed decision is removed without storing a second one", () => {
    const first = confirmProposal([proposal], [other], proposal.id, "me", NOW);
    if (!first.ok) throw new Error("first confirm failed");
    const twin: Proposal = { ...proposal, id: "p-twin", title: "Legal review for launch work", scope: { kind: "label", label: "Launch " } };
    const out = confirmProposal([twin], first.decisions, twin.id, "me", NOW);
    expect(out).toEqual({ ok: true, proposals: [], decisions: first.decisions });
  });

  it("reports an unknown proposal", () => {
    expect(confirmProposal([proposal], [], "p-nope", "me", NOW)).toEqual({ ok: false, reason: "not_found" });
  });

  it("dismiss removes the proposal and touches no decision", () => {
    const decisions = [other];
    expect(dismissProposal([proposal], proposal.id)).toEqual([]);
    expect(dismissProposal([proposal], "p-nope")).toEqual([proposal]);
    expect(decisions).toEqual([other]);
  });
});
