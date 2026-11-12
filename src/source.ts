import api, { route } from "@forge/api";
import { readPageAsUser, remoteLinkPages } from "./confluence";
import { MAX_SOURCE_CHARS, capParts, collectPages } from "./decisions/confluence";
import type { DecisionSource, SourcePart } from "./decisions/types";
import { checkStatus } from "./jira";
import { linkedPagesFromGraph } from "./twg";

type JiraComment = { id?: string; body?: unknown; visibility?: unknown };

// The text a decision may be quoted from: the description and the newest 20 comments, as the caller.
// A comment restricted to a group or role is skipped: its text would otherwise be saved into app
// storage where people outside that group can read it through a proposal.
export async function readSourceAsUser(key: string, cloudId: string | null): Promise<DecisionSource> {
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
  const pages = await readLinkedPages(key, String(issue.id), cloudId);
  const { parts, truncated } = capParts([...raw, ...pages.parts], MAX_SOURCE_CHARS);
  return {
    issueId: String(issue.id),
    projectKey: String(issue.fields?.project?.key ?? ""),
    labels: Array.isArray(issue.fields?.labels) ? issue.fields.labels.filter((l: unknown) => typeof l === "string") : [],
    parts,
    truncated: truncated || pages.truncated,
    unreadablePages: pages.unreadable,
    graphNothing: pages.graphNothing,
  };
}

// Remote links come first so a page found both ways keeps the label of the more direct source.
async function readLinkedPages(key: string, issueId: string, cloudId: string | null) {
  const [links, graph] = await Promise.all([remoteLinkPages(key), linkedPagesFromGraph(cloudId, issueId)]);
  return { ...(await collectPages([...links, ...graph.pages], readPageAsUser)), graphNothing: graph.nothing };
}
