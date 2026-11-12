import type { Constraint, DecisionScope } from "../rules/types";

/**
 * A decision someone found in text but no person has confirmed. It has no `status` and no `source` on
 * purpose: the compiler then refuses it wherever a Decision is expected, so it cannot reach the rules.
 */
export type Proposal = {
  id: string;
  title: string;
  scope: DecisionScope;
  constraints: Constraint[];
  /** The words that justify it, copied from `from` (for example "OPS-1 description"). */
  evidence: { quote: string; from: string };
  proposedAt: string;
};

export type SourcePart = { from: string; text: string };
