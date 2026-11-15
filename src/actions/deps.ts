import { assertProjectVisibleAsUser, isProjectAdminAsUser, jqlErrorsAsUser, openItemsAsUser, readItemAsUser, withJqls } from "../jira";
import { readSourceAsUser } from "../source";
import { getConditionDrafts, getDecisions, getProposals, getRecord, getRules, putConditionDrafts, putDraft, putProposals } from "../store";
import { peopleFromGraph } from "../twg";
import type { ConditionDeps } from "./conditions";
import type { Deps } from "./core";

// Jira reads go through asUser() only. If that fails the action reports "consent"; it never retries as
// the app, which would show a person work items they may not open. The cloud id comes from the caller
// because only the caller's context has it.
export const depsFor = (cloudId: string | null): Deps => ({
  readItem: readItemAsUser,
  getDecisions,
  getRecord,
  getRules,
  putDraft,
  readSource: readSourceAsUser,
  getProposals,
  putProposals,
  people: (issueId) => peopleFromGraph(cloudId, issueId),
  now: () => new Date().toISOString(),
});

// All as the caller, so the counts cover only work items the administrator can open.
export const conditionDeps: ConditionDeps = {
  getDecisions,
  isAdmin: isProjectAdminAsUser,
  jqlErrors: jqlErrorsAsUser,
  openItems: async (projectKey, jqls) => {
    const open = await openItemsAsUser(projectKey);
    if (open.items.length === 0) await assertProjectVisibleAsUser(projectKey);
    return { items: (await withJqls(open.items, jqls, "user")).map((r) => r.item), capped: open.capped };
  },
  getDrafts: getConditionDrafts,
  putDrafts: putConditionDrafts,
  now: () => new Date().toISOString(),
};
