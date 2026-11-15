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
  /**
   * Jira's answer per JQL text, keyed by the exact query. Jira evaluates elsewhere; the rules only read
   * the result. True means the item matches, false that it does not, null or a missing key that it could not be checked.
   */
  conditions?: Record<string, boolean | null>;
};

/** A structured condition a decision places on work. Structured so that code, not a model, decides. */
export type Constraint =
  | { kind: "dueNotAfter"; date: string }
  | { kind: "labelRequired"; label: string }
  | { kind: "labelForbidden"; label: string }
  | { kind: "componentRequired"; component: string }
  | { kind: "componentForbidden"; component: string }
  | { kind: "condition"; jql: string };

export type DecisionScope =
  | { kind: "project"; projectKey: string }
  // projectKey is absent only on decisions stored before label scopes were bound to a project; those stay site-wide.
  | { kind: "label"; label: string; projectKey?: string }
  | { kind: "workItem"; key: string };

/** The words a decision came from. */
export type Evidence = { quote: string; from: string };

export type Decision = {
  id: string;
  title: string;
  status: "decided" | "superseded";
  /** Where a person can read the decision: a work item, or this app's ledger. `confluence` only appears in sample data. */
  /** `link` is where the decision was made, given by a person; Handoff Guard never opens or reads it. */
  source: { kind: "confluence" | "jira" | "ledger"; ref: string; link?: string };
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

/** Optional checks a project administrator switched on for one project. All off is the app as installed. */
export type ProjectRules = { requireContingency: boolean; requireIfThen: boolean; requireReceiverAssigned: boolean };
export const NO_RULES: ProjectRules = { requireContingency: false, requireIfThen: false, requireReceiverAssigned: false };

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
  /** The sender's contingency and the project's optional rules. Absent means no optional rule applies. */
  contingency?: string | null;
  rules?: ProjectRules;
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
    | "decision_not_acknowledged"
    | "no_contingency"
    | "contingency_not_if_then"
    | "receiver_not_assignee";
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
