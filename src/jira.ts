import api, { route } from "@forge/api";
import type { SourcePart } from "./decisions/types";
import { toWorkItem } from "./handoff/build";
import { JiraReadError } from "./jira-error";
import type { WorkItem } from "./rules/types";

// API v2 returns the description as plain text; v3 returns a document tree the rules cannot read.
export const FIELDS = "summary,description,labels,components,duedate,assignee,project";

export const MAX_SOURCE_CHARS = 20_000;

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

export type DecisionSource = {
  issueId: string;
  projectKey: string;
  labels: string[];
  parts: SourcePart[];
  truncated: boolean;
};

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

  let left = MAX_SOURCE_CHARS;
  let truncated = false;
  const parts: SourcePart[] = [];
  for (const p of raw) {
    if (left <= 0) {
      truncated = true;
      break;
    }
    if (p.text.length > left) truncated = true;
    parts.push({ from: p.from, text: p.text.slice(0, left) });
    left -= p.text.length;
  }
  return {
    issueId: String(issue.id),
    projectKey: String(issue.fields?.project?.key ?? ""),
    labels: Array.isArray(issue.fields?.labels) ? issue.fields.labels.filter((l: unknown) => typeof l === "string") : [],
    parts,
    truncated,
  };
}
