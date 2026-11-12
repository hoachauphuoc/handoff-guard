import type { Constraint, DecisionScope } from "../rules/types";

/** A Confluence page a proposal's evidence came from. `ref` is the URL a person can open. */
export type PageRef = { pageId: string; ref: string };

/**
 * A decision someone found in text but no person has confirmed. It has no `status` and no `source` on
 * purpose: the compiler then refuses it wherever a Decision is expected, so it cannot reach the rules.
 */
export type Proposal = {
  id: string;
  title: string;
  scope: DecisionScope;
  constraints: Constraint[];
  /**
   * The words that justify it, copied from `from` (for example "OPS-1 description"). `page` is set only when
   * `from` is a Confluence page: it is what the panel re-reads as the viewer before showing the quote.
   */
  evidence: { quote: string; from: string; page?: PageRef };
  proposedAt: string;
};

/** How a Confluence page was found; shown next to its text so the source is never implied. */
export type PageFoundBy = "remote link" | "Teamwork Graph";

export type SourcePart = { from: string; text: string; page?: PageRef };

export type DecisionSource = {
  issueId: string;
  projectKey: string;
  labels: string[];
  parts: SourcePart[];
  truncated: boolean;
  /** Linked Confluence pages that were skipped because the caller cannot open them (401/403/404). */
  unreadablePages: number;
};
