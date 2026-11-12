import api, { route } from "@forge/api";
import { pagesFromRemoteLinks, type LinkedPage, type PageRead } from "./decisions/pages";
import type { PageVersion } from "./decisions/sourcecheck";

// asUser() only: a page the caller cannot open is counted as unreadable, never retried as the app. Any
// failure (no consent, no permission, a gone page, Confluence not installed) means "cannot open".
export async function readPageAsUser(pageId: string): Promise<PageRead> {
  try {
    const res = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}?body-format=atlas_doc_format`);
    if (!res.ok) return { ok: false };
    const json = await res.json();
    const value = json?.body?.atlas_doc_format?.value;
    if (typeof value !== "string" || typeof json?.title !== "string") return { ok: false };
    return { ok: true, title: json.title, body: JSON.parse(value), version: typeof json?.version?.number === "number" ? json.version.number : null };
  } catch {
    return { ok: false };
  }
}

/** The pages a work item links to, or null when the links could not be read (told to the reader, not hidden). */
export async function remoteLinkPages(key: string): Promise<LinkedPage[] | null> {
  try {
    const res = await api.asUser().requestJira(route`/rest/api/3/issue/${key}/remotelink`);
    return res.ok ? pagesFromRemoteLinks(await res.json()) : null;
  } catch {
    return null;
  }
}

/** Only the title and version of a page, for the changed-source check; no body is fetched. */
export async function readPageVersionAsUser(pageId: string): Promise<PageVersion> {
  try {
    const res = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`);
    if (!res.ok) return { ok: false };
    const json = await res.json();
    return typeof json?.version?.number === "number" && typeof json?.title === "string"
      ? { ok: true, title: json.title, version: json.version.number }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}
