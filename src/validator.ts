import api, { route } from "@forge/api";
import { FIELDS, withConditions } from "./jira";
import { applyModifiedFields, decisionGuardResponse, handoffFrom, heldByThirdPerson, THIRD_PERSON, toWorkItem, validatorResponse } from "./handoff/build";
import type { ValidatorResponse } from "./handoff/types";
import { checkHandoff, checkItem } from "./rules/checkHandoff";
import type { WorkItem } from "./rules/types";
import { getDecisions, getRecord, getRules } from "./store";

type ValidatorPayload = {
  issue: { key: string };
  transition?: { modifiedFields?: Record<string, unknown> };
};

class ReadFailed extends Error {}

// A validator payload carries no user session, so this reads as the app, unlike the panel which reads as
// the viewer. The check can therefore see a work item the person transitioning may not be able to open.
// Due date, labels, description and components from the transition screen are applied when Jira sends them
// (applyModifiedFields); on a site an edited description did not reach the check (docs/READINESS.md, T04). A JQL condition
// is asked of Jira as stored, so a field changed on that screen is not in its answer.
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
    const read = await readAfterTransition(payload);
    const [decisions, record, rules] = await Promise.all([getDecisions(read.item.projectKey), getRecord(read.issueId), getRules(read.item.projectKey)]);
    const item = (await withConditions([read], decisions, "app"))[0]?.item ?? read.item;
    if (!record) {
      return { result: false, errorMessage: "Prepare the handoff in the Handoff Guard panel first." };
    }
    const response = validatorResponse(checkHandoff(handoffFrom(item, record, decisions, rules), decisions));
    // Checked only when the handoff is otherwise Clear: other findings already refuse and say why.
    return response.result && heldByThirdPerson(item, record) ? { result: false, errorMessage: THIRD_PERSON } : response;
  } catch (e) {
    return failClosed(e);
  }
}

// For transitions that are not a handoff: no receiver, no acknowledgement, only the decisions that bind
// the work item.
export async function validateDecisions(payload: ValidatorPayload): Promise<ValidatorResponse> {
  try {
    const read = await readAfterTransition(payload);
    const decisions = await getDecisions(read.item.projectKey);
    const item = (await withConditions([read], decisions, "app"))[0]?.item ?? read.item;
    return decisionGuardResponse(checkItem(item, decisions));
  } catch (e) {
    return failClosed(e);
  }
}

// A gate that cannot check must not let the transition through.
const failClosed = (e: unknown): ValidatorResponse => ({
  result: false,
  errorMessage: `Handoff Guard could not check this work item: ${e instanceof Error ? e.message : "unknown error"}.`,
});
