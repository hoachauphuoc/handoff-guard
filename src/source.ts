import api, { route } from "@forge/api";
import { MAX_SOURCE_CHARS, capParts } from "./decisions/cap";
import type { DecisionSource, SourcePart } from "./decisions/types";
import { checkStatus } from "./jira";

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

  const { parts, truncated } = capParts(raw, MAX_SOURCE_CHARS);
  return {
    issueId: String(issue.id),
    projectKey: String(issue.fields?.project?.key ?? ""),
    labels: Array.isArray(issue.fields?.labels) ? issue.fields.labels.filter((l: unknown) => typeof l === "string") : [],
    parts,
    truncated,
  };
}
