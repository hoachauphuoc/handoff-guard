import api, { route } from "@forge/api";
import { FIELDS } from "./jira";
import { applyModifiedFields, handoffFrom, toWorkItem, validatorResponse } from "./handoff/build";
import type { ValidatorResponse } from "./handoff/types";
import { checkHandoff } from "./rules/checkHandoff";
import { getDecisions, getRecord } from "./store";

type ValidatorPayload = {
  issue: { key: string };
  transition?: { modifiedFields?: Record<string, unknown> };
};

// A validator payload carries no user session, so this reads as the app, unlike the panel which reads as
// the viewer. The check can therefore see a work item the person transitioning may not be able to open.
export async function validate({ issue, transition }: ValidatorPayload): Promise<ValidatorResponse> {
  try {
    const res = await api.asApp().requestJira(route`/rest/api/2/issue/${issue.key}?fields=${FIELDS}`);
    if (!res.ok) return failClosed(res.status);
    const body = await res.json();
    const item = applyModifiedFields(toWorkItem(issue.key, body.fields), transition?.modifiedFields);
    const [decisions, record] = await Promise.all([getDecisions(), getRecord(String(body.id))]);
    if (!record) {
      return { result: false, errorMessage: "Prepare the handoff in the Handoff Guard panel first." };
    }
    return validatorResponse(checkHandoff(handoffFrom(item, record), decisions));
  } catch (e) {
    return failClosed(e instanceof Error ? e.message : "unknown error");
  }
}

// A gate that cannot check must not let the transition through.
const failClosed = (status: unknown): ValidatorResponse => ({
  result: false,
  errorMessage: `Handoff Guard could not check this work item: ${status}.`,
});
