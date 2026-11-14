import { getRecord, replaceRecord } from "./store";
import { runIssueUpdated } from "./trigger";

// Forge passes the event first and its own context second, so the dependencies are bound here, not taken as an argument.
export const issueUpdated = (event: Parameters<typeof runIssueUpdated>[0]) =>
  runIssueUpdated(event, { getRecord, putRecord: replaceRecord, now: () => new Date().toISOString() });
