import { contextStatus, NOT_CHECKED, type ContextStatus } from "./handoff/context";
import { handoffFrom } from "./handoff/build";
import { readItemAsUser } from "./jira";
import { checkHandoff } from "./rules/checkHandoff";
import { getDecisions, getRecord } from "./store";

type ContextPayload = { extension: { issue: { key: string } } };

// Jira calls this for the status beside the collapsed issue context panel. It reads as the viewer like the
// panel; when that is refused or anything fails, the header says "Not checked" rather than guess a verdict.
export async function contextProperties(payload: ContextPayload): Promise<ContextStatus> {
  try {
    const { item, issueId } = await readItemAsUser(payload.extension.issue.key);
    const [decisions, record] = await Promise.all([getDecisions(), getRecord(issueId)]);
    return contextStatus(record ? checkHandoff(handoffFrom(item, record, decisions), decisions) : null);
  } catch (e) {
    console.log(`contextProperties: ${e instanceof Error ? e.message : String(e)}`);
    return NOT_CHECKED;
  }
}
