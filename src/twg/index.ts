import api from "@forge/api";
import { GRAPHQL, issueAri, twgPeople, type Deps, type QueryName } from "./core";

// The Forge runtime provides process.env; the project has no @types/node, so only what is used is declared.
declare const process: { env: Record<string, string | undefined> };

// Saved-query keys come from Forge variables (`forge variables set`) once the owner has registered the
// queries. Until then every call reports nothing.
const VARIABLES: Record<QueryName, string> = {
  shared: "TWG_SHARED_QUERY_KEY",
  mentioned: "TWG_MENTIONED_QUERY_KEY",
};

// asUser() is the only way: Teamwork Graph cannot be called as the app, and results are filtered to what
// the caller may see.
const deps: Deps = {
  queryKey: (name) => process.env[VARIABLES[name]] || null,
  call: async (queryKey, params) => {
    const res = await api.asUser().requestTeamworkGraph(GRAPHQL, { queryKey, queryParams: params });
    return res.json();
  },
};

export async function peopleFromGraph(cloudId: string | null, issueId: string) {
  return twgPeople(deps, cloudId === null ? null : issueAri(cloudId, issueId));
}
