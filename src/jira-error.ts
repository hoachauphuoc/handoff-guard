export type JiraReadCode = "consent" | "not_found" | "jira_error";

// A typed error so callers map failures by code; the panel still matches "Allow access" in the message.
export class JiraReadError extends Error {
  constructor(
    readonly code: JiraReadCode,
    message: string,
  ) {
    super(message);
    this.name = "JiraReadError";
  }
}
