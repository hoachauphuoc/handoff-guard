import { norm } from "../rules/checkHandoff";
import type { Constraint, Decision, DecisionScope } from "../rules/types";
import { mergeDecisions } from "../samples/decisions";
import { fnv1a } from "./hash";
import type { Proposal } from "./types";

const scopeKey = (s: DecisionScope): string =>
  s.kind === "project" ? `project:${norm(s.projectKey)}` : s.kind === "label" ? `label:${norm(s.label)}` : `workItem:${norm(s.key)}`;
const constraintKey = (c: Constraint): string =>
  c.kind === "dueNotAfter" ? `due:${c.date.trim()}` : c.kind === "labelRequired" ? `label:${norm(c.label)}` : `component:${norm(c.component)}`;
const ruleKey = (scope: DecisionScope, constraints: Constraint[]): string =>
  [scopeKey(scope), ...[...new Set(constraints.map(constraintKey))].sort()].join("|");

/**
 * The live decision that already binds the same work in the same way, if any. Titles are ignored: a model
 * words the same sentence differently each time, and the rules only read scope and constraints.
 */
export function sameDecision(decisions: Decision[], scope: DecisionScope, constraints: Constraint[]): Decision | undefined {
  const want = ruleKey(scope, constraints);
  return decisions.find((d) => d.status === "decided" && ruleKey(d.scope, d.constraints) === want);
}

export type ConfirmResult =
  | { ok: true; proposals: Proposal[]; decisions: Decision[] }
  | { ok: false; reason: "not_found" };

/**
 * Turns one proposal into a decision. The decision id comes from the proposal id, so confirming again
 * replaces the same decision instead of adding a second. The evidence quote is not copied into the
 * decision: its source ref says where to read it, and the rules have no use for it.
 */
export function confirmProposal(
  proposals: Proposal[],
  decisions: Decision[],
  id: string,
  who: string,
  nowIso: string,
): ConfirmResult {
  const p = proposals.find((x) => x.id === id);
  if (!p) return { ok: false, reason: "not_found" };
  const rest = proposals.filter((x) => x.id !== id);
  // A proposal saved before its twin was confirmed would otherwise store the same rule twice.
  if (sameDecision(decisions, p.scope, p.constraints)) return { ok: true, proposals: rest, decisions };
  const decision: Decision = {
    id: "d-" + fnv1a(p.id),
    title: p.title,
    status: "decided",
    source: { kind: "jira", ref: p.evidence.from.replace(/ description$/, "") },
    scope: p.scope,
    constraints: p.constraints,
    confirmedBy: who,
    confirmedAt: nowIso,
  };
  return { ok: true, proposals: rest, decisions: mergeDecisions(decisions, [decision]) };
}

export function dismissProposal(proposals: Proposal[], id: string): Proposal[] {
  return proposals.filter((p) => p.id !== id);
}
