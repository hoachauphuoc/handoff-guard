import type { LinkedPage } from "../decisions/confluence";

// Pure: no Forge imports. Teamwork Graph data is advisory. It can add pages to read, and people for a later
// context step, but it never reaches checkHandoff(); a missing scope returns empty rows, not an error, so
// "nothing" is reported as such and never as a fact.

/** The Cypher texts the owner registers as saved queries (new apps cannot send raw Cypher). */
export const QUERIES = {
  pages:
    "MATCH (i:JiraWorkItem {ari: $issueAri})-[:content_entity_links_entity]->(p:ConfluencePage) RETURN p",
  shared:
    "MATCH (i:JiraWorkItem {ari: $issueAri})-[:jira_work_item_shared_with_atlassian_user]->(u:AtlassianUser) RETURN u",
  // Relation name and direction are unconfirmed in the docs; registration validates the name.
  mentioned:
    "MATCH (u:AtlassianUser)-[:atlassian_user_mentioned_in_jira_work_item]->(i:JiraWorkItem {ari: $issueAri}) RETURN u",
} as const;

export type QueryName = keyof typeof QUERIES;

// Operation names must look like [company]_[operation]; Teamwork Graph rejects others with HTTP 200 and errors.
export const GRAPHQL = `query handoffguard_related($queryKey: String!, $queryParams: CypherRequestParams) {
  customQuery(queryKey: $queryKey, queryParams: $queryParams, first: 25) {
    edges { node { columns { key value { __typename ... on CypherQueryResultNode { id } } } } }
  }
}`;

export const issueAri = (cloudId: string, issueId: string): string => `ari:cloud:jira:${cloudId}:issue/${issueId}`;

export type GraphIds = { ok: true; aris: string[] } | { ok: false; reason: string };

/** The ARIs in the result nodes of a customQuery response, or why there are none. */
export function parseAris(json: unknown): GraphIds {
  const j = json as { data?: { customQuery?: { edges?: unknown } | null }; errors?: { extensions?: { code?: unknown }; message?: unknown }[] } | null;
  const edges = j?.data?.customQuery?.edges;
  if (!Array.isArray(edges)) {
    const code = j?.errors?.[0]?.extensions?.code ?? j?.errors?.[0]?.message;
    return { ok: false, reason: typeof code === "string" ? code : "no data" };
  }
  const aris: string[] = [];
  for (const e of edges) {
    for (const c of e?.node?.columns ?? []) {
      const id = c?.value?.id;
      if (typeof id === "string") aris.push(id);
    }
  }
  return { ok: true, aris };
}

export const pageIdFromAri = (ari: string): string | null => /^ari:cloud:confluence:[^:]*:page\/(\d+)/.exec(ari)?.[1] ?? null;
export const accountIdFromAri = (ari: string): string | null => /^ari:cloud:identity::user\/(.+)$/.exec(ari)?.[1] ?? null;

export type Deps = {
  /** Saved query key from configuration, or null when the owner has not registered the query yet. */
  queryKey: (name: QueryName) => string | null;
  call: (queryKey: string, params: { issueAri: string }) => Promise<unknown>;
};

export type TwgPages = {
  pages: LinkedPage[];
  /** True when Teamwork Graph gave no page: nothing linked, a scope not granted, no saved query, or a failure. */
  nothing: boolean;
};

async function ids(deps: Deps, name: QueryName, ari: string): Promise<string[]> {
  const key = deps.queryKey(name);
  if (key === null) return [];
  try {
    const out = parseAris(await deps.call(key, { issueAri: ari }));
    return out.ok ? out.aris : [];
  } catch {
    return [];
  }
}

export async function twgLinkedPages(deps: Deps, ari: string | null): Promise<TwgPages> {
  const aris = ari === null ? [] : await ids(deps, "pages", ari);
  const pages: LinkedPage[] = [];
  for (const a of aris) {
    const pageId = pageIdFromAri(a);
    if (pageId !== null) pages.push({ pageId, url: null, foundBy: "Teamwork Graph" });
  }
  return { pages, nothing: pages.length === 0 };
}

/** People connected to the work item. For a later context step only; no rule reads them. */
export async function twgPeople(deps: Deps, ari: string | null): Promise<{ sharedWith: string[]; mentioned: string[] }> {
  if (ari === null) return { sharedWith: [], mentioned: [] };
  const [shared, mentioned] = await Promise.all([ids(deps, "shared", ari), ids(deps, "mentioned", ari)]);
  const accounts = (xs: string[]) => [...new Set(xs.flatMap((x) => accountIdFromAri(x) ?? []))];
  return { sharedWith: accounts(shared), mentioned: accounts(mentioned) };
}
