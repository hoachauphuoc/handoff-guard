import api, { route } from "@forge/api";
import { hasAdminPermission } from "./authz";
import { itemsFromSearch, toWorkItem } from "./handoff/build";
import { JiraReadError } from "./jira-error";
import type { WorkItem } from "./rules/types";

// API v2 returns the description as plain text; v3 returns a document tree the rules cannot read.
export const FIELDS = "summary,description,labels,components,duedate,assignee,project";

export const OPEN_ITEM_CAP = 100;

// Open work items of one project, as the caller. The key is checked before it goes into a query.
export async function openItemsAsUser(projectKey: string): Promise<{ items: { item: WorkItem; issueId: string }[]; capped: boolean }> {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(projectKey)) throw new JiraReadError("jira_error", "That project key is not valid.");
  const jql = `project = "${projectKey}" AND statusCategory != Done ORDER BY key`;
  const res = await api.asUser().requestJira(route`/rest/api/2/search/jql?jql=${jql}&fields=${FIELDS}&maxResults=${OPEN_ITEM_CAP}`);
  checkStatus(res, projectKey);
  return itemsFromSearch(await res.json());
}

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

// Fails closed: a refused or failed permission read means "not an administrator", never "allowed".
export async function isProjectAdminAsUser(projectKey: string): Promise<boolean> {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(projectKey)) return false;
  try {
    const res = await api.asUser().requestJira(route`/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=ADMINISTER_PROJECTS`);
    return res.ok && hasAdminPermission(await res.json());
  } catch {
    return false;
  }
}
