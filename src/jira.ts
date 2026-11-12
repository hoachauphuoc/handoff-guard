import api, { route } from "@forge/api";
import { readPageAsUser, remoteLinkPages } from "./confluence";
import { MAX_SOURCE_CHARS, capParts, collectPages } from "./decisions/confluence";
import type { DecisionSource, SourcePart } from "./decisions/types";
import { toWorkItem } from "./handoff/build";
import { JiraReadError } from "./jira-error";
import type { WorkItem } from "./rules/types";

// API v2 returns the description as plain text; v3 returns a document tree the rules cannot read.
export const FIELDS = "summary,description,labels,components,duedate,assignee,project";

// When Jira asks for consent the error says so; it is never retried as the app, which would hide the
// missing access.
function checkStatus(res: { status: number; ok: boolean }, key: string): void {
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

type JiraComment = { id?: string; body?: unknown; visibility?: unknown };

// The text a decision may be quoted from: the description and the newest 20 comments, as the caller.
// A comment restricted to a group or role is skipped: its text would otherwise be saved into app
// storage where people outside that group can read it through a proposal.
export async function readSourceAsUser(key: string): Promise<DecisionSource> {
  const issueRes = await api.asUser().requestJira(route`/rest/api/2/issue/${key}?fields=description,labels,project`);
  checkStatus(issueRes, key);
  const issue = await issueRes.json();
  const commentsRes = await api
    .asUser()
    .requestJira(route`/rest/api/2/issue/${key}/comment?orderBy=-created&maxResults=20`);
  checkStatus(commentsRes, key);
  const comments: JiraComment[] = (await commentsRes.json()).comments ?? [];

  const raw: SourcePart[] = [];
  if (typeof issue.fields?.description === "string") raw.push({ from: `${key} description`, text: issue.fields.description });
  for (const c of comments) {
    if (c.visibility || typeof c.body !== "string" || c.id === undefined) continue;
    raw.push({ from: `${key} comment ${c.id}`, text: c.body });
  }

  // Jira text comes first so a long page cannot push out the work item's own words.
  const pages = await readLinkedPages(key);
  const { parts, truncated } = capParts([...raw, ...pages.parts], MAX_SOURCE_CHARS);
  return {
    issueId: String(issue.id),
    projectKey: String(issue.fields?.project?.key ?? ""),
    labels: Array.isArray(issue.fields?.labels) ? issue.fields.labels.filter((l: unknown) => typeof l === "string") : [],
    parts,
    truncated: truncated || pages.truncated,
    unreadablePages: pages.unreadable,
  };
}

async function readLinkedPages(key: string) {
  return collectPages(await remoteLinkPages(key), readPageAsUser);
}
