import type { Handoff, HandoffResult, WorkItem } from "../rules/types";
import type { HandoffRecord, ValidatorResponse } from "./types";

type JiraFields = {
  project?: { key?: string };
  summary?: string | null;
  description?: string | null;
  labels?: string[] | null;
  components?: { name: string }[] | null;
  duedate?: string | null;
  assignee?: { accountId?: string } | null;
};

/** Builds the rule input from a Jira REST v2 issue; v2 gives the description as plain text. */
export function toWorkItem(key: string, fields: JiraFields): WorkItem {
  return {
    key,
    projectKey: fields.project?.key ?? "",
    summary: fields.summary ?? "",
    description: fields.description ?? "",
    labels: fields.labels ?? [],
    components: (fields.components ?? []).map((c) => c.name),
    dueDate: fields.duedate ?? null,
    assigneeId: fields.assignee?.accountId ?? null,
  };
}

/**
 * Overlays the fields a transition screen is about to save, so the check sees the state after the move.
 * Only due date and labels are applied. Description arrives as a REST v3 document tree and components
 * as objects the rules cannot trust, so they are left as stored on purpose.
 */
export function applyModifiedFields(item: WorkItem, modified: Record<string, unknown> | undefined): WorkItem {
  if (!modified) return item;
  const next = { ...item };
  if ("duedate" in modified) {
    const v = modified.duedate;
    next.dueDate = typeof v === "string" ? v : null;
  }
  if ("labels" in modified) {
    const v = modified.labels;
    next.labels = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  }
  return next;
}

export function handoffFrom(item: WorkItem, record: HandoffRecord | null): Handoff {
  return record
    ? { item, fromId: record.fromId, toId: record.toId, acknowledged: record.acknowledged }
    : { item, fromId: null, toId: null, acknowledged: [] };
}

/** Allows the transition only for a clear verdict; every finding goes into the message. */
export function validatorResponse(result: HandoffResult): ValidatorResponse {
  if (result.verdict === "clear") return { result: true };
  return { result: false, errorMessage: result.findings.map((f) => f.message).join(" ") };
}

/**
 * A what-if handoff for a receiver the caller names. Acknowledgements are dropped on purpose: they were
 * given by another person, so a preview must not inherit them.
 */
export function previewHandoff(
  item: WorkItem,
  record: HandoffRecord | null,
  receiverId: string,
  callerId: string | null,
): Handoff {
  return { item, fromId: record?.fromId ?? callerId, toId: receiverId, acknowledged: [] };
}
