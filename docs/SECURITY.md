# Security

- Runs on Atlassian; no remote service, no egress, no secrets in the app. Scopes are listed with reasons in the README.
- The verdict is plain code (`src/rules/`, pure). Models never decide it. Proposals, Teamwork Graph data and people data have no path into `checkHandoff()`; tests check this.
- Reads of Jira and Teamwork Graph use `asUser()`. The one use of `asApp()` is in `src/validator.ts`: the workflow validator reads the work item (summary, description, labels, components, due date, assignee, project) as the app, because a validator payload carries no user session. There is no fallback to `asApp()` anywhere else: a missing permission is reported, never bypassed.
- A model's proposed decision is kept only if its quote appears word for word in text the caller can read, re-read on the server. A person must confirm it.
- The workflow validator fails closed: it blocks the transition when the check cannot run.
- Rovo MCP access is off until a site admin enables it; tools then act within the calling user's permissions.
- Not covered: the validator can read a work item the person making the transition may not be able to open, and reads decisions as the app (storage is app-wide); the validator's `modifiedFields` ignores description and components.
