import { readItemAsUser } from "../jira";
import { readSourceAsUser } from "../source";
import { getDecisions, getProposals, getRecord, putProposals } from "../store";
import { runCheckHandoff, runListBindingDecisions, runProposeDecisions, runReadDecisionSource, type Deps } from "./core";

// Jira reads go through asUser() only. If that fails the action reports "consent"; it never retries as
// the app, which would show a person work items they may not open.
const deps: Deps = {
  readItem: readItemAsUser,
  getDecisions,
  getRecord,
  readSource: (key) => readSourceAsUser(key, null),
  getProposals,
  putProposals,
  now: () => new Date().toISOString(),
};

type Ctx = { accountId?: string; cloudId?: string };

// The site id builds the work item ARI for Teamwork Graph. The Rovo MCP tutorial shows it in payload.context
// (not yet seen on a real call here; logShape below shows it); without it Teamwork Graph is skipped and the result says it returned nothing.
const withCloud = (payload: unknown, context: Ctx): Deps => {
  const cloudId = (payload as { context?: { cloudId?: unknown } } | undefined)?.context?.cloudId ?? context?.cloudId;
  return { ...deps, readSource: (key) => readSourceAsUser(key, typeof cloudId === "string" ? cloudId : null) };
};

// TEMPORARY (see docs/PROGRESS.md): logs key names only, never values, to show where accountId and the
// Jira context sit on a real Rovo call. Remove after the owner confirms.
function logShape(payload: unknown, context: unknown): void {
  const keys = (o: unknown) => (o && typeof o === "object" ? Object.keys(o) : []);
  const p = payload as { context?: { jira?: unknown } } | undefined;
  console.log(
    JSON.stringify({
      payload: keys(payload),
      "payload.context": keys(p?.context),
      "payload.context.jira": keys(p?.context?.jira),
      context: keys(context),
    }),
  );
}

export async function checkHandoffAction(payload: unknown, context: Ctx) {
  logShape(payload, context);
  return runCheckHandoff(payload, context?.accountId ?? null, deps);
}

export async function listBindingDecisionsAction(payload: unknown, context: Ctx) {
  logShape(payload, context);
  return runListBindingDecisions(payload, deps);
}

export async function readDecisionSourceAction(payload: unknown, context: Ctx) {
  logShape(payload, context);
  return runReadDecisionSource(payload, withCloud(payload, context));
}

export async function proposeDecisionsAction(payload: unknown, context: Ctx) {
  logShape(payload, context);
  return runProposeDecisions(payload, withCloud(payload, context));
}
