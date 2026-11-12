// JSON Schema (2020-12) for the Rovo action inputs and outputs. Kept free of Forge imports so a later
// rovo:mcp module can reuse the same contract. Rovo itself takes no output schema; these document it.

import type { Advisory } from "../rules/advisories";
import type { PageStatus } from "../decisions/pages";
import type { Constraint } from "../rules/types";

export const SCHEMA_VERSION = {
  check: "handoff-guard/check-handoff@1",
  list: "handoff-guard/binding-decisions@1",
  source: "handoff-guard/decision-source@1",
  propose: "handoff-guard/propose-decisions@1",
  gather: "handoff-guard/handoff-context@1",
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
export const GatherInputSchema = ListBindingInputSchema;

export const ProposeInputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    issueKey: { type: "string", description: "Work item key such as OPS-1. Defaults to the work item the chat was opened from." },
    candidates: {
      type: "string",
      description:
        'A JSON array, as a string, of {title, scope, constraints, evidence}. scope is one of {"kind":"project"} (all work in this project), {"kind":"workItem"} (this work item only) or {"kind":"label","label":"x"} (only if this work item already has label x). constraints is 1 to 3 of {"kind":"dueNotAfter","date":"YYYY-MM-DD"}, {"kind":"labelRequired","label":"x"}, {"kind":"labelForbidden","label":"x"}, {"kind":"componentRequired","component":"x"} or {"kind":"componentForbidden","component":"x"}. evidence is {"quote":"..."} copied word for word from the read-decision-source result. Example: [{"title":"Launch work needs legal review","scope":{"kind":"project"},"constraints":[{"kind":"labelRequired","label":"legal-reviewed"}],"evidence":{"quote":"all launch work needs the legal-reviewed label"}}]',
    },
  },
  required: ["candidates"],
  additionalProperties: false,
} as const;

export type CheckHandoffInput = { issueKey?: string; receiverAccountId?: string };
export type ListBindingInput = { issueKey?: string };
export type ReadSourceInput = ListBindingInput;
export type ProposeInput = { issueKey?: string; candidates: string };
export type GatherInput = { issueKey?: string };

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
  /** Edits that would stop the item contradicting its decisions. Advice only: never part of the verdict or quote. */
  fixes: string[];
  /** What an agent says right after the quote when asked to start the work; chosen by the verdict, copied as is. */
  startLine: string;
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
  /** `marked`: decisions a person marked with Jira's decision node inside `text`; propose these first. */
  parts: { from: string; text: string; marked?: string[] }[];
  truncated: boolean;
  /** What happened to linked Confluence pages; absent when none were attempted. */
  pages?: PageStatus;
  quote: string;
};

export type ReadSourceOutput = ReadSourceSuccess | ActionError<typeof SCHEMA_VERSION.source>;

export type ProposeSuccess = {
  schema: typeof SCHEMA_VERSION.propose;
  ok: true;
  source: "rules";
  issueKey: string;
  proposed: { id: string; title: string; scope: unknown; constraints: unknown[]; evidence: { quote: string; from: string } }[];
  rejected: { index: number; reason: string; message: string }[];
  quote: string;
};

export type ProposeOutput = ProposeSuccess | ActionError<typeof SCHEMA_VERSION.propose>;

export type PeopleStatus = "ok" | "nothing" | "not_configured";

/** What the graph call returned. `reason` only says why nothing was asked. */
export type PeopleRead = {
  status: PeopleStatus;
  sharedWith: string[];
  mentioned: string[];
  reason?: "no_site" | "no_query";
};

/** Advisory and never a rule input: the verdict does not read it. */
export type People = {
  source: "Teamwork Graph";
  status: PeopleStatus;
  sharedWith: string[];
  mentioned: string[];
  note: string;
};

export type GatherSuccess = {
  schema: typeof SCHEMA_VERSION.gather;
  ok: true;
  source: "rules";
  issueKey: string;
  item: {
    key: string;
    projectKey: string;
    summary: string;
    description: string;
    descriptionTruncated: boolean;
    labels: string[];
    components: string[];
    dueDate: string | null;
    assigneeId: string | null;
  };
  /** Newest first; comments only, never the description. */
  comments: { from: string; text: string }[];
  /** The same object check-handoff returns, untouched. */
  check: CheckHandoffSuccess;
  binding: { id: string; title: string; source: DecisionSource; constraints: Constraint[]; acknowledged: boolean }[];
  people: People;
  /** Sibling of `check`, never part of it: facts to look at, not findings. Empty when there is no handoff basis. */
  advisories: Advisory[];
  quote: string;
};

export type GatherOutput = GatherSuccess | ActionError<typeof SCHEMA_VERSION.gather>;
