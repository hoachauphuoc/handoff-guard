import type { Decision } from "../rules/types";
import { mergeDecisions } from "../samples/decisions";
import { fnv1a } from "./hash";
import type { Proposal } from "./types";

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
  return { ok: true, proposals: proposals.filter((x) => x.id !== id), decisions: mergeDecisions(decisions, [decision]) };
}

export function dismissProposal(proposals: Proposal[], id: string): Proposal[] {
  return proposals.filter((p) => p.id !== id);
}
