import api, { route } from "@forge/api";
import { FIELDS } from "./jira";
import { applyModifiedFields, decisionGuardResponse, handoffFrom, toWorkItem, validatorResponse } from "./handoff/build";
import type { ValidatorResponse } from "./handoff/types";
import { checkHandoff, checkItem } from "./rules/checkHandoff";
import type { WorkItem } from "./rules/types";
import { getDecisions, getRecord } from "./store";

type ValidatorPayload = {
  issue: { key: string };
  transition?: { modifiedFields?: Record<string, unknown> };
};

class ReadFailed extends Error {}

// A validator payload carries no user session, so this reads as the app, unlike the panel which reads as
// the viewer. The check can therefore see a work item the person transitioning may not be able to open.
async function readAfterTransition({ issue, transition }: ValidatorPayload): Promise<{ item: WorkItem; issueId: string }> {
  const res = await api.asApp().requestJira(route`/rest/api/2/issue/${issue.key}?fields=${FIELDS}`);
  if (!res.ok) throw new ReadFailed(String(res.status));
  const body = await res.json();
  return {
    item: applyModifiedFields(toWorkItem(issue.key, body.fields), transition?.modifiedFields),
    issueId: String(body.id),
  };
}

export async function validate(payload: ValidatorPayload): Promise<ValidatorResponse> {
  try {
    const { item, issueId } = await readAfterTransition(payload);
    const [decisions, record] = await Promise.all([getDecisions(item.projectKey), getRecord(issueId)]);
    if (!record) {
      return { result: false, errorMessage: "Prepare the handoff in the Handoff Guard panel first." };
    }
    return validatorResponse(checkHandoff(handoffFrom(item, record, decisions), decisions));
  } catch (e) {
    return failClosed(e);
  }
}

// For transitions that are not a handoff: no receiver, no acknowledgement, only the decisions that bind
// the work item.
export async function validateDecisions(payload: ValidatorPayload): Promise<ValidatorResponse> {
  try {
    const { item } = await readAfterTransition(payload);
    return decisionGuardResponse(checkItem(item, await getDecisions(item.projectKey)));
  } catch (e) {
    return failClosed(e);
  }
}

// A gate that cannot check must not let the transition through.
const failClosed = (e: unknown): ValidatorResponse => ({
  result: false,
  errorMessage: `Handoff Guard could not check this work item: ${e instanceof Error ? e.message : "unknown error"}.`,
});
