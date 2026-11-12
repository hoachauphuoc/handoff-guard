import type { Constraint, DecisionScope, Evidence } from "../rules/types";
import type { PageStatus } from "./pages";

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
  evidence: Evidence;
  proposedAt: string;
};

/** `marked`: decisions a person marked with Jira's decision node inside `text`, as written. */
export type SourcePart = { from: string; text: string; marked?: string[]; page?: { pageId: string; version: number } };

export type DecisionSource = {
  issueId: string;
  projectKey: string;
  labels: string[];
  parts: SourcePart[];
  truncated: boolean;
  /** What happened to linked Confluence pages. Absent when no page read was attempted. */
  pages?: PageStatus;
};
