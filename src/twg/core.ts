import type { PeopleRead } from "../actions/schema";

// Pure: no Forge imports. Teamwork Graph data is advisory. It adds people to the handoff brief,
// but it never reaches checkHandoff(); a missing scope returns empty rows, not an error, so "nothing" is
// reported as such and never as a fact. A call that fails twice is reported as "error", not as "nothing". Pages are not queried: a Jira-only app cannot read their text.

/** The Cypher texts the owner registers as saved queries (new apps cannot send raw Cypher). */
export const QUERIES = {
  shared:
    "MATCH (i:JiraWorkItem {ari: $issueAri})-[:jira_work_item_shared_with_atlassian_user]->(u:AtlassianUser) RETURN u",
  // Relation confirmed in the Teamwork Graph reference (user -> work item, description mentions only).
  // `shared` is an Activity relation that expires after 90 days.
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

export const accountIdFromAri = (ari: string): string | null => /^ari:cloud:identity::user\/(.+)$/.exec(ari)?.[1] ?? null;

export type Deps = {
  /** Saved query key from configuration, or null when the owner has not registered the query yet. */
  queryKey: (name: QueryName) => string | null;
  call: (queryKey: string, params: { issueAri: string }) => Promise<unknown>;
};

// null means the query was asked and could not be read, even after one retry; [] is an empty answer.
async function ids(deps: Deps, name: QueryName, ari: string): Promise<string[] | null> {
  const key = deps.queryKey(name);
  if (key === null) return [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = parseAris(await deps.call(key, { issueAri: ari }));
      if (out.ok) return out.aris;
    } catch {
      // A throttled or failed call is retried once below.
    }
  }
  return null;
}

/**
 * People connected to the work item, for the handoff brief only; no rule reads them. The status keeps
 * "we did not ask" apart from "we asked and got nothing", because a missing scope or permission looks
 * like an empty answer.
 */
export async function twgPeople(deps: Deps, ari: string | null): Promise<PeopleRead> {
  const none = { sharedWith: [], mentioned: [] };
  if (ari === null) return { status: "not_configured", reason: "no_site", ...none };
  if (deps.queryKey("shared") === null && deps.queryKey("mentioned") === null) {
    return { status: "not_configured", reason: "no_query", ...none };
  }
  const [shared, mentioned] = await Promise.all([ids(deps, "shared", ari), ids(deps, "mentioned", ari)]);
  // An unanswered query is not "nobody": the UI must name it as a failed read (principle 3).
  if (shared === null && mentioned === null) return { status: "error", reason: "read_failed", ...none };
  const accounts = (xs: string[] | null) => [...new Set((xs ?? []).flatMap((x) => accountIdFromAri(x) ?? []))];
  const out = { sharedWith: accounts(shared), mentioned: accounts(mentioned) };
  const partial = shared === null || mentioned === null ? { partial: true } : {};
  return { status: out.sharedWith.length + out.mentioned.length > 0 ? "ok" : "nothing", ...out, ...partial };
}
