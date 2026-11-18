import {
  callerAccountId,
  callerCloudId,
  runCheckHandoff,
  runDraftReceipt,
  runGatherHandoffContext,
  runListBindingDecisions,
  runProposeDecisions,
  runReadDecisionSource,
} from "./core";
import { runCheckCondition, runDraftCondition } from "./conditions";
import { conditionDeps, depsFor } from "./deps";

type Ctx = { accountId?: string; cloudId?: string; installContext?: string; principal?: { accountId?: unknown } };

// Only the brief reads the graph, so only it needs the cloud id; the others never call `people`.
const plain = depsFor(null);

// Seen on a real Rovo call: the caller's accountId is payload.context.accountId. The second argument is
// kept as a fallback for callers that pass it there.
export async function checkHandoffAction(payload: unknown, context: Ctx) {
  return runCheckHandoff(payload, callerAccountId(payload, context), plain);
}

export async function listBindingDecisionsAction(payload: unknown) {
  return runListBindingDecisions(payload, plain);
}

export async function readDecisionSourceAction(payload: unknown) {
  return runReadDecisionSource(payload, plain);
}

export async function proposeDecisionsAction(payload: unknown) {
  return runProposeDecisions(payload, plain);
}

export async function draftReceiptAction(payload: unknown, context: Ctx) {
  return runDraftReceipt(payload, callerAccountId(payload, context), plain);
}

export async function gatherHandoffContextAction(payload: unknown, context: Ctx) {
  return runGatherHandoffContext(payload, callerAccountId(payload, context), depsFor(callerCloudId(payload, context)));
}

export async function checkConditionAction(payload: unknown) {
  return runCheckCondition(payload, conditionDeps);
}

export async function draftConditionAction(payload: unknown, context: Ctx) {
  return runDraftCondition(payload, callerAccountId(payload, context), conditionDeps);
}
