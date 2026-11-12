import type { Constraint, DecisionScope } from "../rules/types";
import type { PageRef, Proposal } from "./types";

/** What the panel receives. The quote is withheld when the viewer cannot open the page it came from. */
export type ProposalView = {
  id: string;
  title: string;
  scope: DecisionScope;
  constraints: Constraint[];
  evidence: { quote: string | null; from: string; page?: PageRef };
  /** False when the evidence is on a Confluence page the viewer cannot open; Confirm is then disabled. */
  canConfirm: boolean;
};

export const EVIDENCE_HIDDEN = "Evidence is on a Confluence page you cannot open";

export function proposalViews(proposals: Proposal[], openablePages: ReadonlySet<string>): ProposalView[] {
  return proposals.map((p) => {
    const visible = !p.evidence.page || openablePages.has(p.evidence.page.pageId);
    return { ...p, evidence: { ...p.evidence, quote: visible ? p.evidence.quote : null }, canConfirm: visible };
  });
}
