import type { Decision } from "../rules/types";
import { mergeDecisions } from "../samples/decisions";
import { fnv1a } from "./hash";
import { relate, splitOverlap, supersede } from "./supersede";
import type { Proposal } from "./types";

const sourceOf = (from: string): Decision["source"] => ({ kind: "jira", ref: from.replace(/ description$/, "") });

export type ConfirmResult =
  | { ok: true; proposals: Proposal[]; decisions: Decision[] }
  | { ok: false; reason: "not_found" };

/**
 * Turns one proposal into a decision. The decision id comes from the proposal id, so confirming again
 * replaces the same decision instead of adding a second. The evidence stays on the decision only to
 * recognise, later, which marked decisions are already recorded; the rules never read it.
 */
export function confirmProposal(
  proposals: Proposal[],
  decisions: Decision[],
  id: string,
  who: string,
  nowIso: string,
  retire = false,
): ConfirmResult {
  const p = proposals.find((x) => x.id === id);
  if (!p) return { ok: false, reason: "not_found" };
  const rest = proposals.filter((x) => x.id !== id);
  // A proposal saved before its twin was confirmed would otherwise store the same rule twice.
  const relation = relate(decisions, p.scope, p.constraints);
  if (relation?.kind === "already_decided") return { ok: true, proposals: rest, decisions };
  const decision: Decision = {
    id: "d-" + fnv1a(p.id),
    title: p.title,
    status: "decided",
    source: sourceOf(p.evidence.from),
    scope: p.scope,
    constraints: p.constraints,
    confirmedBy: who,
    confirmedAt: nowIso,
    evidence: p.evidence,
  };
  // Retiring is the person's choice, made with the button; it is worked out here from stored decisions, never from what the caller sends.
  // Only decisions this person may retire; the others stay in force, as they would on the Decisions page.
  const retirable = retire ? splitOverlap(decisions, p.scope, p.constraints, who).retirable : [];
  const kept = retirable.length > 0 ? supersede(decisions, retirable.map((d) => d.id), nowIso, decision.id) : decisions;
  return { ok: true, proposals: rest, decisions: mergeDecisions(kept, [decision]) };
}

export function dismissProposal(proposals: Proposal[], id: string): Proposal[] {
  return proposals.filter((p) => p.id !== id);
}
