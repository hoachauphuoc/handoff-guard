export type WorkItem = {
  key: string;
  projectKey: string;
  summary: string;
  description: string;
  labels: string[];
  components: string[];
  /** ISO date (YYYY-MM-DD), or null when unset. */
  dueDate: string | null;
  assigneeId: string | null;
};

/** A structured condition a decision places on work. Structured so that code, not a model, decides. */
export type Constraint =
  | { kind: "dueNotAfter"; date: string }
  | { kind: "labelRequired"; label: string }
  | { kind: "labelForbidden"; label: string }
  | { kind: "componentRequired"; component: string }
  | { kind: "componentForbidden"; component: string };

export type DecisionScope =
  | { kind: "project"; projectKey: string }
  | { kind: "label"; label: string }
  | { kind: "workItem"; key: string };

/** The words a decision came from. `pageId` and `version` are set when they came from a Confluence page. */
export type Evidence = { quote: string; from: string; pageId?: string; version?: number };

export type Decision = {
  id: string;
  title: string;
  status: "decided" | "superseded";
  /** Where a person can read the decision: a Confluence page, a work item, or this app's ledger. */
  source: { kind: "confluence" | "jira" | "ledger"; ref: string };
  scope: DecisionScope;
  constraints: Constraint[];
  /** Set when a person confirmed a proposal. The rules ignore both fields. */
  confirmedBy?: string;
  confirmedAt?: string;
  /** The words a proposal was confirmed from, so a marked decision can be told apart from one already recorded. */
  evidence?: Evidence;
  /** Set when the decision stopped binding: when, and the decision that replaced it (absent if a person retired it). */
  supersededAt?: string;
  supersededBy?: string;
};

export type Handoff = {
  item: WorkItem;
  fromId: string | null;
  toId: string | null;
  /** Decision ids the receiver has acknowledged reading. */
  acknowledged: string[];
  /**
   * Decision id -> why an acknowledgement no longer holds (a field the decision reads changed after it was
   * given). Worked out outside the rules from the record; here it is plain data, like `acknowledged`.
   */
  stale?: Record<string, string>;
};

export type Finding = {
  rule:
    | "no_sender"
    | "no_receiver"
    | "same_person"
    | "empty_description"
    | "no_due_date"
    | "invalid_due_date"
    | "invalid_constraint"
    | "contradicts_decision"
    | "decision_not_acknowledged";
  severity: "block" | "info_needed";
  message: string;
  decisionId?: string;
};

export type Verdict = "clear" | "needs_info" | "blocked";

export type HandoffResult = {
  verdict: Verdict;
  findings: Finding[];
  /** Every decision that applies to this item, contradicted or not, so the receiver sees the full set. */
  binding: Decision[];
};
