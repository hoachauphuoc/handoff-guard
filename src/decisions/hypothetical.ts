import type { Decision } from "../rules/types";
import type { Proposal } from "./types";

/**
 * A proposal dressed as a decision, only so `impactOf` can count the work items it would contradict. The
 * result is never stored and never reaches the rule check, the validator or the ledger.
 */
export const hypothetical = (p: Proposal): Decision => ({
  id: p.id,
  title: p.title,
  status: "decided",
  source: { kind: "jira", ref: p.evidence.from },
  scope: p.scope,
  constraints: p.constraints,
});
