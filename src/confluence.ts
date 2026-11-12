import api, { route } from "@forge/api";
import { pageUrl, pagesFromRemoteLinks, storageToText, type LinkedPage, type PageRead } from "./decisions/confluence";

// asUser() only: a page the caller cannot open is skipped, never retried as the app. Any non-2xx counts as
// "cannot open" (401/403 no consent or no permission, 404 gone or hidden); the caller is told how many.
export async function readPageAsUser(pageId: string): Promise<PageRead> {
  const res = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}?body-format=storage`);
  if (!res.ok) return { ok: false };
  const body = await res.json();
  const storage = body?.body?.storage?.value;
  if (typeof storage !== "string") return { ok: false };
  return { ok: true, text: storageToText(storage), url: pageUrl(body) };
}

/** Which of these pages the current viewer can open right now. */
export async function openablePageIds(pageIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(pageIds)];
  const reads = await Promise.all(unique.map(async (id) => ((await readPageAsUser(id)).ok ? id : null)));
  return new Set(reads.filter((x): x is string => x !== null));
}

// Pages the work item links to with a Jira remote link. A failed read yields none: the links are an extra
// source, not a reason to fail the Jira read that already succeeded.
export async function remoteLinkPages(key: string): Promise<LinkedPage[]> {
  const res = await api.asUser().requestJira(route`/rest/api/2/issue/${key}/remotelink`);
  return res.ok ? pagesFromRemoteLinks(await res.json()) : [];
}
