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
  | { kind: "componentForbidden"; component: string };

export type DecisionScope =
  | { kind: "project"; projectKey: string }
  | { kind: "label"; label: string }
  | { kind: "workItem"; key: string };

export type Decision = {
  id: string;
  title: string;
  status: "decided" | "superseded";
  /** Where a person can read the decision: a Confluence page, a work item, or this app's ledger. */
  source: { kind: "confluence" | "jira" | "ledger"; ref: string };
  scope: DecisionScope;
  constraints: Constraint[];
};

export type Handoff = {
  item: WorkItem;
  fromId: string | null;
  toId: string | null;
  /** Decision ids the receiver has acknowledged reading. */
  acknowledged: string[];
};

export type Finding = {
  rule:
    | "no_receiver"
    | "same_person"
    | "empty_description"
    | "no_due_date"
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
