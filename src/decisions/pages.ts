import { adfToText, markedDecisions } from "../adf";
import { count } from "../plural";
import type { SourcePart } from "./types";

export const MAX_PAGES = 3;

export type LinkedPage = { pageId: string; url: string | null };

type RemoteLink = { globalId?: unknown; application?: { type?: unknown }; object?: { url?: unknown } };

/**
 * Confluence pages among a work item's remote links, each once. Jira writes the application type
 * "com.atlassian.confluence..." for Confluence links, so it is matched as a prefix. The page id comes from
 * the globalId (`appId=...&pageId=N`) or from the URL.
 */
export function pagesFromRemoteLinks(json: unknown): LinkedPage[] {
  if (!Array.isArray(json)) return [];
  const seen = new Set<string>();
  const out: LinkedPage[] = [];
  for (const l of json as RemoteLink[]) {
    const type = l?.application?.type;
    if (typeof type !== "string" || !type.startsWith("com.atlassian.confluence")) continue;
    const url = typeof l.object?.url === "string" ? l.object.url : null;
    const id = [typeof l.globalId === "string" ? l.globalId : "", url ?? ""]
      .map((c) => /[?&]pageId=(\d+)/.exec(c)?.[1] ?? /\/pages\/(\d+)/.exec(c)?.[1])
      .find((v) => v !== undefined);
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    out.push({ pageId: id, url });
  }
  return out;
}

export type PageRead = { ok: true; title: string; body: unknown; version: number | null } | { ok: false };

/** What happened to the pages, so a reader is told when a source was not read instead of left to assume. */
export type PageStatus = {
  /** False when the work item's links could not be read at all. */
  linksRead: boolean;
  linked: number;
  read: number;
  unreadable: number;
  /** Linked pages never tried because of the limit. */
  notTried: number;
};

export const NO_PAGES: PageStatus = { linksRead: true, linked: 0, read: 0, unreadable: 0, notTried: 0 };

/**
 * At most MAX_PAGES readable pages, tried from at most twice that many links so an unreadable page does not
 * hide a readable one forever and the number of calls stays bounded. A page the reader cannot open is
 * counted, never read another way.
 */
export async function collectPages(
  links: LinkedPage[],
  read: (pageId: string) => Promise<PageRead>,
): Promise<{ parts: SourcePart[]; status: PageStatus }> {
  const parts: SourcePart[] = [];
  let unreadable = 0;
  let tried = 0;
  for (const l of links) {
    if (parts.length >= MAX_PAGES || tried >= MAX_PAGES * 2) break;
    tried++;
    const page = await read(l.pageId);
    if (!page.ok) {
      unreadable++;
      continue;
    }
    const text = adfToText(page.body);
    if (text.trim() === "") continue;
    const marked = markedDecisions(page.body);
    const from = `Confluence page ${page.title}`;
    parts.push({ from, text, ...(marked.length > 0 ? { marked } : {}), ...(page.version !== null ? { page: { pageId: l.pageId, version: page.version } } : {}) });
  }
  return { parts, status: { linksRead: true, linked: links.length, read: parts.length, unreadable, notTried: links.length - tried } };
}

/** One plain sentence naming what was and was not read. Shown in the panel and in the action's quote. */
export function pageStatusText(s: PageStatus): string {
  if (!s.linksRead) return "Confluence: the links of this work item could not be read, so no linked page was read.";
  if (s.linked === 0) return "Confluence: no page is linked to this work item.";
  const lines = [`Confluence: read ${s.read} of ${count(s.linked, "linked page")}`];
  if (s.unreadable > 0) {
    lines.push(`${count(s.unreadable, "page")} could not be opened as you (no permission, or Confluence is not installed on this site)`);
  }
  if (s.notTried > 0) lines.push(`${count(s.notTried, "page")} not tried (limit ${MAX_PAGES} pages)`);
  return lines.join("; ") + ".";
}
