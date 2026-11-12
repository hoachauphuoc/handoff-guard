import api, { route } from "@forge/api";
import { readPageAsUser, remoteLinkPages } from "./confluence";
import { MAX_SOURCE_CHARS, capParts } from "./decisions/cap";
import { buildParts, type JiraComment } from "./decisions/parts";
import { collectPages, type PageStatus } from "./decisions/pages";
import type { DecisionSource } from "./decisions/types";
import { checkStatus } from "./jira";

// The text a decision may be quoted from: the description and the newest 20 comments, as the caller. They
// are read as Jira documents (REST v3) so decisions marked with the decision node can be told from plain
// text; comments restricted to a group or role are left out by buildParts.
export async function readSourceAsUser(key: string): Promise<DecisionSource> {
  const issueRes = await api.asUser().requestJira(route`/rest/api/3/issue/${key}?fields=description,labels,project`);
  checkStatus(issueRes, key);
  const issue = await issueRes.json();
  const commentsRes = await api
    .asUser()
    .requestJira(route`/rest/api/3/issue/${key}/comment?orderBy=-created&maxResults=20`);
  checkStatus(commentsRes, key);
  const comments: JiraComment[] = (await commentsRes.json()).comments ?? [];

  // Jira text comes first so a long page cannot push out the work item's own words.
  const links = await remoteLinkPages(key);
  const pages = links === null
    ? { parts: [], status: { linksRead: false, linked: 0, read: 0, unreadable: 0, notTried: 0 } satisfies PageStatus }
    : await collectPages(links, readPageAsUser);
  const { parts, truncated } = capParts([...buildParts(key, issue.fields?.description, comments), ...pages.parts], MAX_SOURCE_CHARS);
  return {
    issueId: String(issue.id),
    projectKey: String(issue.fields?.project?.key ?? ""),
    labels: Array.isArray(issue.fields?.labels) ? issue.fields.labels.filter((l: unknown) => typeof l === "string") : [],
    parts,
    truncated,
    pages: pages.status,
  };
}
