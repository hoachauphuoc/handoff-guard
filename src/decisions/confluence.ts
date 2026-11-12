import type { PageFoundBy, SourcePart } from "./types";

export const MAX_PAGES = 3;
export const MAX_SOURCE_CHARS = 20_000;

// A null-prototype object: "constructor" and the like are not entities.
const NAMED: Record<string, string | undefined> = Object.assign(Object.create(null), { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" });

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e.startsWith("#")) {
      const n = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/**
 * Confluence storage format (XHTML plus ac:/ri: macro tags) to the plain text a person reads. Both the
 * model and the evidence check see exactly this text, so a quote can only match words that are on the page.
 * Macro parameters are configuration, not prose, so they are dropped; a macro's rich-text body is kept.
 */
export function storageToText(storage: string): string {
  return decodeEntities(
    storage
      .replace(/<!--[\s\S]*?-->/g, "")
      // CDATA (code macros) is literal text: escape it so the entity pass below does not decode it twice.
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "\n")
      .replace(/<ac:parameter\b[\s\S]*?<\/ac:parameter>/gi, "")
      .replace(/<\/?(p|li|h[1-6]|tr|div|blockquote|pre)\b[^>]*>|<br\s*\/?>/gi, "\n")
      .replace(/<\/(td|th)>/gi, " ")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type LinkedPage = { pageId: string; url: string | null; foundBy: PageFoundBy };

type RemoteLink = { globalId?: unknown; application?: { type?: unknown }; object?: { url?: unknown } };

/**
 * Confluence pages among a work item's remote links. The application type "com.atlassian.confluence" is
 * what Jira writes for Confluence links (seen in Atlassian KB examples, not in the REST reference), so
 * it is matched as a prefix. The page id comes from the globalId (`appId=...&pageId=N`) or the URL.
 */
export function pagesFromRemoteLinks(json: unknown): LinkedPage[] {
  if (!Array.isArray(json)) return [];
  const out: LinkedPage[] = [];
  for (const l of json as RemoteLink[]) {
    const type = l?.application?.type;
    if (typeof type !== "string" || !type.startsWith("com.atlassian.confluence")) continue;
    const url = typeof l.object?.url === "string" ? l.object.url : null;
    const candidates = [typeof l.globalId === "string" ? l.globalId : "", url ?? ""];
    const id = candidates
      .map((c) => /[?&]pageId=(\d+)/.exec(c)?.[1] ?? /\/pages\/(\d+)/.exec(c)?.[1])
      .find((v) => v !== undefined);
    if (id !== undefined) out.push({ pageId: id, url, foundBy: "remote link" });
  }
  return out;
}

export function dedupePages(pages: LinkedPage[]): LinkedPage[] {
  const seen = new Set<string>();
  return pages.filter((p) => (seen.has(p.pageId) ? false : (seen.add(p.pageId), true)));
}

/** The URL a person can open, from a v2 page response; null when the response does not carry one. */
export function pageUrl(json: unknown): string | null {
  const links = (json as { _links?: { base?: unknown; webui?: unknown } } | null)?._links;
  return typeof links?.base === "string" && typeof links.webui === "string" ? links.base + links.webui : null;
}

export function pageFrom(pageId: string, foundBy: PageFoundBy): string {
  return `Confluence page ${pageId} (found by ${foundBy})`;
}

/** Jira parts first, then pages, cut at the shared character cap. */
export function capParts(raw: SourcePart[], limit = MAX_SOURCE_CHARS): { parts: SourcePart[]; truncated: boolean } {
  let left = limit;
  let truncated = false;
  const parts: SourcePart[] = [];
  for (const p of raw) {
    if (left <= 0) {
      truncated = true;
      break;
    }
    if (p.text.length > left) truncated = true;
    parts.push({ ...p, text: p.text.slice(0, left) });
    left -= p.text.length;
  }
  return { parts, truncated };
}

export type PageRead = { ok: true; text: string; url: string | null } | { ok: false };

/**
 * At most MAX_PAGES readable pages, tried from at most twice that many links so unreadable ones do not hide
 * a readable one forever and the number of calls stays bounded. A page the reader cannot open is counted,
 * never substituted by another reader.
 */
export async function collectPages(
  links: LinkedPage[],
  read: (pageId: string) => Promise<PageRead>,
): Promise<{ parts: SourcePart[]; unreadable: number; truncated: boolean }> {
  const linked = dedupePages(links);
  const parts: SourcePart[] = [];
  let unreadable = 0;
  let tried = 0;
  for (const l of linked) {
    if (parts.length >= MAX_PAGES || tried >= MAX_PAGES * 2) break;
    tried++;
    const page = await read(l.pageId);
    if (!page.ok) {
      unreadable++;
      continue;
    }
    parts.push({
      from: pageFrom(l.pageId, l.foundBy),
      text: page.text,
      page: { pageId: l.pageId, ref: page.url ?? l.url ?? `Confluence page ${l.pageId}` },
    });
  }
  return { parts, unreadable, truncated: linked.length > tried };
}
