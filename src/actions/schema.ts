// JSON Schema (2020-12) for the Rovo action inputs and outputs. Kept free of Forge imports so a later
// rovo:mcp module can reuse the same contract. Rovo itself takes no output schema; these document it.

export const SCHEMA_VERSION = {
  check: "handoff-guard/check-handoff@1",
  list: "handoff-guard/binding-decisions@1",
  source: "handoff-guard/decision-source@1",
  propose: "handoff-guard/propose-decisions@1",
} as const;

export const CheckHandoffInputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    issueKey: { type: "string", description: "Work item key such as OPS-1. Defaults to the work item the chat was opened from." },
    receiverAccountId: { type: "string", description: "Atlassian account id of the person who would receive the work item." },
  },
  additionalProperties: false,
} as const;

export const ListBindingInputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    issueKey: { type: "string", description: "Work item key such as OPS-1. Defaults to the work item the chat was opened from." },
  },
  additionalProperties: false,
} as const;

export const ReadSourceInputSchema = ListBindingInputSchema;

export const ProposeInputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    issueKey: { type: "string", description: "Work item key such as OPS-1. Defaults to the work item the chat was opened from." },
    candidates: {
      type: "string",
      description:
        'A JSON array of {title, scope:{kind: project, label or workItem}, constraints:[{kind: dueNotAfter, labelRequired or componentForbidden}], evidence:{quote}}. Each quote is copied word for word from the read-decision-source result.',
    },
  },
  required: ["candidates"],
  additionalProperties: false,
} as const;

export type CheckHandoffInput = { issueKey?: string; receiverAccountId?: string };
export type ListBindingInput = { issueKey?: string };
export type ReadSourceInput = ListBindingInput;
export type ProposeInput = { issueKey?: string; candidates: string };

export type ErrorCode = "bad_input" | "consent" | "not_found" | "jira_error" | "internal";

export type ActionError<S extends string> = {
  schema: S;
  ok: false;
  source: "rules";
  issueKey: string | null;
  error: { code: ErrorCode; message: string };
  quote: string;
};

export type DecisionSource = { kind: "confluence" | "jira" | "ledger"; ref: string };

export type CheckHandoffSuccess = {
  schema: typeof SCHEMA_VERSION.check;
  ok: true;
  source: "rules";
  issueKey: string;
  /** stored: the saved handoff record; preview: a receiver was named that differs from the record; none: nothing to check. */
  basis: "stored" | "preview" | "none";
  verdict: "clear" | "needs_info" | "blocked" | null;
  verdictText: "Clear" | "Needs info" | "Blocked" | null;
  senderId: string | null;
  receiverId: string | null;
  findings: { rule: string; severity: "block" | "info_needed"; message: string; decisionId?: string }[];
  binding: { id: string; title: string; source: DecisionSource; acknowledged: boolean }[];
  quote: string;
};

export type CheckHandoffOutput = CheckHandoffSuccess | ActionError<typeof SCHEMA_VERSION.check>;

export type ListBindingSuccess = {
  schema: typeof SCHEMA_VERSION.list;
  ok: true;
  source: "rules";
  issueKey: string;
  storedDecisionCount: number;
  decisions: { id: string; title: string; source: DecisionSource; constraints: unknown[] }[];
  quote: string;
};

export type ListBindingOutput = ListBindingSuccess | ActionError<typeof SCHEMA_VERSION.list>;

export type ReadSourceSuccess = {
  schema: typeof SCHEMA_VERSION.source;
  ok: true;
  source: "rules";
  issueKey: string;
  parts: { from: string; text: string }[];
  truncated: boolean;
  quote: string;
};

export type ReadSourceOutput = ReadSourceSuccess | ActionError<typeof SCHEMA_VERSION.source>;

export type ProposeSuccess = {
  schema: typeof SCHEMA_VERSION.propose;
  ok: true;
  source: "rules";
  issueKey: string;
  proposed: { id: string; title: string; scope: unknown; constraints: unknown[]; evidence: { quote: string; from: string } }[];
  rejected: { index: number; reason: string }[];
  quote: string;
};

export type ProposeOutput = ProposeSuccess | ActionError<typeof SCHEMA_VERSION.propose>;
