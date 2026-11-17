import { adfToText } from "../adf";
import { bindingDecisions } from "../rules/checkHandoff";
import { NO_RULES, type Decision, type Finding, type Handoff, type HandoffResult, type ProjectRules, type WorkItem } from "../rules/types";
import { staleAcks } from "./drift";
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
 * Due date, labels, description (a REST v3 document, read as text) and components (objects; only their
 * names are kept) are applied. The assignee is left as stored: a change of assignee starts a new handoff
 * through the trigger, which the transition cannot wait for.
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
  if ("description" in modified) next.description = modified.description === null ? "" : adfToText(modified.description);
  if ("components" in modified) {
    const v = modified.components;
    next.components = Array.isArray(v)
      ? v.flatMap((c) => (typeof c === "object" && c !== null && typeof (c as { name?: unknown }).name === "string" ? [(c as { name: string }).name] : []))
      : [];
  }
  return next;
}

/**
 * Open work items from a Jira search response. `capped` is true when Jira says more results exist, so a
 * count taken from these items is a lower bound and the page can say so.
 */
export function itemsFromSearch(json: unknown): { items: { item: WorkItem; issueId: string }[]; capped: boolean } {
  const body = (json ?? {}) as { issues?: { id?: unknown; key?: unknown; fields?: JiraFields }[]; isLast?: unknown; nextPageToken?: unknown };
  const items = (Array.isArray(body.issues) ? body.issues : []).flatMap((i) =>
    typeof i?.key === "string" && i.id !== undefined ? [{ item: toWorkItem(i.key, i.fields ?? {}), issueId: String(i.id) }] : [],
  );
  return { items, capped: body.isLast === false || typeof body.nextPageToken === "string" };
}

export function handoffFrom(item: WorkItem, record: HandoffRecord | null, decisions: Decision[], rules: ProjectRules = NO_RULES): Handoff {
  return record
    ? {
        item,
        fromId: record.fromId,
        toId: record.toId,
        acknowledged: record.acknowledged,
        stale: staleAcks(record.acknowledged, record.acknowledgedWith, item, bindingDecisions(decisions, item)),
        contingency: record.contingency ?? null,
        rules,
      }
    : { item, fromId: null, toId: null, acknowledged: [] };
}

/** Allows the transition only for a clear verdict; every finding goes into the message. */
export function validatorResponse(result: HandoffResult): ValidatorResponse {
  if (result.verdict === "clear") return { result: true };
  return { result: false, errorMessage: result.findings.map((f) => f.message).join(" ") };
}

export const THIRD_PERSON =
  "The work item is assigned to someone who is neither the sender nor the receiver of the prepared handoff. Prepare the handoff again for the current assignee.";

/**
 * True when the work item is held by a third person. A Clear handoff says the receiver read back the decisions;
 * it says nothing about anyone else, so the gate must not open for them. The sender still holding the item, or
 * no assignee at all, is the normal state before the reassignment and is not refused.
 */
export function heldByThirdPerson(item: WorkItem, record: { fromId: string; toId: string }): boolean {
  if (item.assigneeId === null) return false;
  const who = item.assigneeId.trim().toLowerCase();
  return who !== record.fromId.trim().toLowerCase() && who !== record.toId.trim().toLowerCase();
}

/** The decision gate: allows the transition only when the work item breaks no binding decision. */
export function decisionGuardResponse(findings: Finding[]): ValidatorResponse {
  if (findings.length === 0) return { result: true };
  return { result: false, errorMessage: findings.map((f) => f.message).join(" ") };
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

export const WALKTHROUGH_RECEIVER = "example-receiver (practice)";

/**
 * A made-up handoff used only by the panel's practice check, so a newcomer sees what is missing from the
 * work item before choosing a receiver. Every binding decision counts as acknowledged, which keeps the
 * practice findings about the work item itself. Nothing built here may reach the validator, the Rovo
 * actions or the measure script: it is not a real handoff and must never produce a verdict.
 */
export function walkthroughHandoff(item: WorkItem, viewerId: string | null, bindingIds: string[]): Handoff {
  return { item, fromId: viewerId ?? "example-sender (practice)", toId: WALKTHROUGH_RECEIVER, acknowledged: bindingIds };
}
