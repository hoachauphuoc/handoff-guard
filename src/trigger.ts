import { detectReassignment } from "./handoff/detect";
import type { HandoffRecord } from "./handoff/types";

export type TriggerDeps = {
  getRecord: (issueId: string) => Promise<HandoffRecord | null>;
  putRecord: (issueId: string, record: HandoffRecord) => Promise<void>;
  now: () => string;
};

type IssueUpdated = { issue?: { id?: unknown }; changelog?: { items?: unknown } };

/**
 * A work item changed hands in Jira: record it as a handoff so the receiver's decisions are listed without
 * anyone pressing a button. The event carries no user session and this reads nothing from Jira; it only
 * writes the handoff record, which the rule check then reads like any other.
 */
export async function runIssueUpdated(event: IssueUpdated, deps: TriggerDeps): Promise<void> {
  const issueId = event?.issue?.id === undefined ? null : String(event.issue.id);
  if (issueId === null) return;
  const record = detectReassignment(event.changelog?.items, await deps.getRecord(issueId), deps.now());
  if (record !== null) await deps.putRecord(issueId, record);
}
