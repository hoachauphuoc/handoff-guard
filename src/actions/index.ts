import { readItemAsUser } from "../jira";
import { readSourceAsUser } from "../source";
import { getDecisions, getProposals, getRecord, putProposals } from "../store";
import { callerAccountId, runCheckHandoff, runListBindingDecisions, runProposeDecisions, runReadDecisionSource, type Deps } from "./core";

// Jira reads go through asUser() only. If that fails the action reports "consent"; it never retries as
// the app, which would show a person work items they may not open.
const deps: Deps = {
  readItem: readItemAsUser,
  getDecisions,
  getRecord,
  readSource: readSourceAsUser,
  getProposals,
  putProposals,
  now: () => new Date().toISOString(),
};

type Ctx = { accountId?: string; cloudId?: string };

// Seen on a real Rovo call: the caller's accountId is payload.context.accountId. The second argument is
// kept as a fallback for callers that pass it there.
export async function checkHandoffAction(payload: unknown, context: Ctx) {
  return runCheckHandoff(payload, callerAccountId(payload, context), deps);
}

export async function listBindingDecisionsAction(payload: unknown) {
  return runListBindingDecisions(payload, deps);
}

export async function readDecisionSourceAction(payload: unknown) {
  return runReadDecisionSource(payload, deps);
}

export async function proposeDecisionsAction(payload: unknown) {
  return runProposeDecisions(payload, deps);
}
