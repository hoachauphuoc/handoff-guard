import type { Decision } from "../rules/types";
import { mergeDecisions } from "../samples/decisions";
import { fnv1a } from "./hash";
import type { Proposal } from "./types";

export type ConfirmResult =
  | { ok: true; proposals: Proposal[]; decisions: Decision[] }
  | { ok: false; reason: "not_found" | "evidence_not_visible" };

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
  openablePages: ReadonlySet<string> = new Set(),
): ConfirmResult {
  const p = proposals.find((x) => x.id === id);
  if (!p) return { ok: false, reason: "not_found" };
  // The confirmer must be able to read the evidence they are confirming; restrictions inherited from a
  // parent page are invisible to the restrictions API, so the caller proves it by re-reading the page.
  if (p.evidence.page && !openablePages.has(p.evidence.page.pageId)) return { ok: false, reason: "evidence_not_visible" };
  const decision: Decision = {
    id: "d-" + fnv1a(p.id),
    title: p.title,
    status: "decided",
    source: p.evidence.page
      ? { kind: "confluence", ref: p.evidence.page.ref }
      : { kind: "jira", ref: p.evidence.from.replace(/ description$/, "") },
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
