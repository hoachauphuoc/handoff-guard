import api, { route } from "@forge/api";
import { hasAdminPermission } from "./authz";
import { doneStatusIds, toChanges, type Change } from "./autopsy/bounce";
import { itemsFromSearch, toWorkItem } from "./handoff/build";
import { JiraReadError } from "./jira-error";
import type { StartProject } from "./guide/start";
import { CONDITION_CAP, conditionJqls, conditionsOf, keyListJql, validJqls, withAnswers } from "./decisions/conditions";
import type { Decision, WorkItem } from "./rules/types";
import { getDecisions } from "./store";

// API v2 returns the description as plain text; v3 returns a document tree the rules cannot read.
export const FIELDS = "summary,description,labels,components,duedate,assignee,project";

export const OPEN_ITEM_CAP = 100;

// Open work items of one project, as the caller. The key is checked before it goes into a query.
export function openItemsAsUser(projectKey: string): Promise<{ items: { item: WorkItem; issueId: string }[]; capped: boolean }> {
  return searchAsUser(projectKey, "statusCategory != Done ORDER BY key");
}

export const RECENT_DAYS = 60;

// Work items of one project changed lately, done or not, newest first. The autopsy needs the finished ones
// too: a handoff that went well ends in Done, and leaving those out would make every handoff look bounced.
export function recentItemsAsUser(projectKey: string): Promise<{ items: { item: WorkItem; issueId: string }[]; capped: boolean }> {
  return searchAsUser(projectKey, `updated >= -${RECENT_DAYS}d ORDER BY updated DESC`);
}

async function searchAsUser(projectKey: string, rest: string): Promise<{ items: { item: WorkItem; issueId: string }[]; capped: boolean }> {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(projectKey)) throw new JiraReadError("jira_error", "That project key is not valid.");
  const jql = `project = "${projectKey}" AND ${rest}`;
  const [res, decisions] = await Promise.all([
    api.asUser().requestJira(route`/rest/api/2/search/jql?jql=${jql}&fields=${FIELDS}&maxResults=${OPEN_ITEM_CAP}`),
    getDecisions(projectKey),
  ]);
  checkStatus(res, projectKey);
  const found = itemsFromSearch(await res.json());
  return { ...found, items: await withConditions(found.items, decisions, "user") };
}

type As = "user" | "app";
const requester = (as: As) => (as === "user" ? api.asUser() : api.asApp());

/**
 * Fills each work item's answer to the JQL conditions of the decisions in force: one parse for all of them,
 * then one search per condition over all the given work items. Nothing is asked when no decision has a
 * condition. Any failure leaves that answer null, which the rules report as not checked, never as a match.
 * The panel and the actions ask as the viewer; the validator, which has no viewer, asks as the app.
 */
export async function withConditions<T extends { item: WorkItem }>(rows: T[], decisions: Decision[], as: As): Promise<T[]> {
  const all = conditionJqls(decisions);
  if (all.length === 0 || rows.length === 0) return rows;
  const jqls = all.slice(0, CONDITION_CAP);
  const keys = rows.map((r) => r.item.key);
  const matched = new Map<string, Set<string> | null>();
  let valid = new Set<string>();
  try {
    const res = await requester(as).requestJira(route`/rest/api/3/jql/parse?validation=strict`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ queries: jqls }),
    });
    if (res.ok) valid = validJqls(jqls, await res.json());
  } catch {
    // Left empty: every condition reads as not checked.
  }
  await Promise.all(
    jqls.map(async (jql) => {
      if (!valid.has(jql)) return matched.set(jql, null);
      try {
        const query = keyListJql(keys, jql);
        const res = await requester(as).requestJira(route`/rest/api/3/search/jql?jql=${query}&fields=summary&maxResults=${keys.length}`);
        const body = res.ok ? ((await res.json()) as { issues?: { key: string }[] }) : null;
        return matched.set(jql, body ? new Set((body.issues ?? []).map((i) => i.key)) : null);
      } catch {
        return matched.set(jql, null);
      }
    }),
  );
  return withAnswers(rows, conditionsOf(keys, all, matched));
}

// The projects the caller can see, for the start page's picker. At most 50: the page is a front door, not a list.
export async function projectsAsUser(): Promise<StartProject[]> {
  const res = await api.asUser().requestJira(route`/rest/api/3/project/search?maxResults=50&orderBy=name`);
  checkStatus(res, "the project list");
  const body = (await res.json()) as { values?: { key: string; name: string; projectTypeKey?: string }[] };
  return (body.values ?? []).map((p) => ({ key: p.key, name: p.name, type: p.projectTypeKey ?? "software" }));
}

// The open work item changed last, so the start page links to something real. Null when there is none.
export async function latestOpenItemAsUser(projectKey: string): Promise<string | null> {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(projectKey)) throw new JiraReadError("jira_error", "That project key is not valid.");
  const jql = `project = "${projectKey}" AND statusCategory != Done ORDER BY updated DESC`;
  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql?jql=${jql}&fields=summary&maxResults=1`);
  checkStatus(res, projectKey);
  const body = (await res.json()) as { issues?: { key: string }[] };
  return body.issues?.[0]?.key ?? null;
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
// The project's decisions are read beside the work item, from the key, so a work item with no condition
// waits no longer than before; a moved work item reads its new project's decisions after.
export async function readItemAsUser(key: string): Promise<{ item: WorkItem; issueId: string }> {
  const guess = key.split("-")[0] ?? "";
  const [res, guessed] = await Promise.all([api.asUser().requestJira(route`/rest/api/2/issue/${key}?fields=${FIELDS}`), getDecisions(guess)]);
  checkStatus(res, key);
  const body = await res.json();
  const row = { item: toWorkItem(key, body.fields), issueId: String(body.id) };
  const decisions = row.item.projectKey === guess ? guessed : await getDecisions(row.item.projectKey);
  const [filled] = await withConditions([row], decisions, "user");
  return filled ?? row;
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

// The latest changes of one work item, as the caller (Jira returns the most recent 100 with the item).
export async function changesAsUser(key: string): Promise<Change[]> {
  const res = await api.asUser().requestJira(route`/rest/api/3/issue/${key}?expand=changelog&fields=summary`);
  checkStatus(res, key);
  return toChanges((await res.json()).changelog);
}

// Which statuses of the project count as Done, as the caller.
export async function doneStatusIdsAsUser(projectKey: string): Promise<string[]> {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(projectKey)) throw new JiraReadError("jira_error", "That project key is not valid.");
  const res = await api.asUser().requestJira(route`/rest/api/3/project/${projectKey}/statuses`);
  checkStatus(res, projectKey);
  return doneStatusIds(await res.json());
}
