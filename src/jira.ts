import api, { route } from "@forge/api";
import { toWorkItem } from "./handoff/build";
import { JiraReadError } from "./jira-error";
import type { WorkItem } from "./rules/types";

// API v2 returns the description as plain text; v3 returns a document tree the rules cannot read.
export const FIELDS = "summary,description,labels,components,duedate,assignee,project";

// When Jira asks for consent the error says so; it is never retried as the app, which would hide the
// missing access.
export function checkStatus(res: { status: number; ok: boolean }, key: string): void {
  if (res.status === 401 || res.status === 403) {
    throw new JiraReadError("consent", `Allow access: Jira did not let Handoff Guard read ${key} as you (status ${res.status}).`);
  }
  if (res.status === 404) throw new JiraReadError("not_found", `Jira has no work item ${key} that you can see.`);
  if (!res.ok) throw new JiraReadError("jira_error", `Jira returned ${res.status} for ${key}`);
}

// Reads as the caller, so a person only sees what their own permissions allow.
export async function readItemAsUser(key: string): Promise<{ item: WorkItem; issueId: string }> {
  const res = await api.asUser().requestJira(route`/rest/api/2/issue/${key}?fields=${FIELDS}`);
  checkStatus(res, key);
  const body = await res.json();
  return { item: toWorkItem(key, body.fields), issueId: String(body.id) };
}
