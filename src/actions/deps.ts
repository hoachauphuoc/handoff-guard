import { readItemAsUser } from "../jira";
import { readSourceAsUser } from "../source";
import { getDecisions, getProposals, getRecord, putProposals } from "../store";
import { peopleFromGraph } from "../twg";
import type { Deps } from "./core";

// Jira reads go through asUser() only. If that fails the action reports "consent"; it never retries as
// the app, which would show a person work items they may not open. The cloud id comes from the caller
// because only the caller's context has it.
export const depsFor = (cloudId: string | null): Deps => ({
  readItem: readItemAsUser,
  getDecisions,
  getRecord,
  readSource: readSourceAsUser,
  getProposals,
  putProposals,
  people: (issueId) => peopleFromGraph(cloudId, issueId),
  now: () => new Date().toISOString(),
});
