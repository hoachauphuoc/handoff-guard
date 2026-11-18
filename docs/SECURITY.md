# Security

- Runs on Atlassian; no remote service of ours, no egress from the app, no secrets in the app. If a site administrator enables the Rovo MCP server, a client of their choosing receives tool results under the calling user's permissions. Scopes are listed with reasons in the README.
- The verdict is plain code (`src/rules/`, pure). Models never decide it. Proposals, Teamwork Graph data and people data have no path into `checkHandoff()`; tests check this.
- Reads of Jira and Teamwork Graph use `asUser()`. `asApp()` is used only on the path of the two workflow validators, because a validator payload carries no user session: `src/validator.ts` reads the work item (summary, description, labels, components, due date, assignee, project) as the app, and `src/jira.ts` asks Jira for the result of a Jira filter decision as the app when the validator calls it (the panel, the Rovo actions and the counts ask as the user). There is no fallback to `asApp()` anywhere else: a missing permission is reported, never bypassed. All eight Rovo actions are declared `actionVerb: GET`, although `propose-decisions`, `draft-receipt` and `draft-condition` store something: none of them changes Jira or anything in force. Each stores only a proposal or draft that binds nothing until a person confirms it in the panel or on the Decisions page.
- A model's proposed decision is kept only if its quote appears word for word in text the caller can read, re-read on the server. A person must confirm it.
- The workflow validator fails closed: it blocks the transition when the check cannot run.
- Rovo MCP access is off until a site admin enables it; tools then act within the calling user's permissions. The caller is taken from the field the platform sets (`context.principal`), and from the call's own input only when the platform gives none, so a client cannot name another person as the caller.
- Not covered: the validator can read a work item the person making the transition may not be able to open, and reads decisions as the app (storage is app-wide); of the fields edited on the transition screen (`modifiedFields`), the validator applies due date, labels, description and components; any other field edited there is checked as stored. The assignee is checked as stored, and a Jira filter decision is answered by Jira on the stored work item.
- Not covered: the validator checks that the prepared handoff is Clear, not that its receiver is the current assignee. A reassignment to a different person starts a new handoff record through the trigger, but a transition is not refused on that ground alone.
- Covered (each write resolver has a test that the wrong person is refused and nothing is stored, `tests/resolvers.test.ts`; what was tried on a site is in `docs/READINESS.md`): the server checks Jira's "Administer projects" permission, as the person, before it confirms, adds or supersedes a decision or loads or removes samples; a failed check counts as "no". Re-preparing a prepared handoff is limited to its sender, the assignee or a project administrator. Superseding is also limited to the person who confirmed the decision; a decision with no recorded confirmer, such as a sample, can be superseded by any administrator.
- A decision scoped to a label binds only the project it was confirmed in. A label decision confirmed before 2026-11-13 carries no project and keeps binding that label on the whole site until it is superseded.
- Not covered: the evidence check proves that the quote is in the source text, not that the constraints follow from it. A proposal can pair a real quote with a constraint the quote does not state; only the person confirming can judge that, and the panel shows both before Confirm.
- Not covered: `propose-decisions` writes proposals to storage, also when called over MCP. It keeps at most 5 per work item and replaces that item's pending proposals, so a call can displace proposals waiting there. Nothing binds until a person confirms.
- Covered: `draft-condition` stores a draft only for a caller Jira says is a project administrator (a failed check counts as "no"), only for a filter Jira can parse, and at most 10 per project. `check-condition` reads only, as the caller, so its counts cover only work items that person can open. A draft binds nothing: confirming it on the Decisions page runs the same administrator check, the same build and the same Jira parse as the form.
- Not covered: a condition is evaluated by Jira, as the viewer in the panel and as the app in the validator, so the two can differ where permissions differ; only a yes or no about one work item comes back.
- Partly covered: decisions are stored per project, so one project cannot break another, and a save of the decisions or of a handoff record holds only while its save count is the one read (a conditional storage transaction). A single project with a very large number of decisions would still hit the size limit. The old site-wide key is kept, read-only, until the owner confirms the new keys work. The trigger writes a handoff record whenever an assignee changes; the app never writes to Jira, so there is no loop.
- `npm audit` reports vulnerabilities only inside the dependencies of `@forge/react` and `@forge/bridge` (mostly an editor library). The app uses no editor and runs in Forge's sandbox; they can be fixed only by a Forge release.

## When the validator cannot check

The validator refuses a transition it cannot check (Jira or storage did not answer), so a failure can hold up urgent work. The refusal says "Handoff Guard could not check this work item:" and the cause.

- To let work through, a Jira administrator removes the Handoff Guard validator from that transition in the workflow editor. The app has no bypass of its own, so nobody else can switch the gate off; Jira's audit log records the workflow change.
- After recovery, the administrator adds the validator back. Work items moved in the meantime were not checked: open the Decisions page, where "Handoffs in flight" lists each handoff that is not Clear.
- The refusal itself is covered by `tests/validator.test.ts` (Jira, storage and filter failures, both validators).
- Drill run by the author on the test site, 2026-11-18, production 3.66.0, project MOBL: the validator was removed from the "Architecture Review" transition; MOBL-53, whose handoff was not Clear, then moved to Architecture Review with no check; the validator was added back; Jira's audit log showed "Workflow updated" with its author for the removal and for the re-add; the Decisions page listed MOBL-53 under "Handoffs in flight"; MOBL-53 was moved back, and the same move was then refused with "The receiver has not acknowledged …". Not tried with an operations team or under time pressure.

## Bounds the app relies on

| What | Bound | Where |
|---|---|---|
| Open work items read for a project page | 100, and the page says when the list was cut | `src/jira.ts` |
| Work items read by Bounce autopsy | 50 with a stored handoff, changed in the last 60 days | `src/resolvers/index.ts` |
| Work items reached by Export and Delete | every one the administrator can see, open or done, up to 2000 stored work items per site; the delete message says when cut | `src/store.ts`, `src/jira.ts` |
| Activity list per project | latest 300 events | `src/audit.ts` |
| Proposals per work item | 5 | `src/decisions/validate.ts` |
| Decisions per project | one storage value per project; not capped by the app, so a very large number would meet the storage value limit | `src/store.ts` |
| Jira and storage calls | no retry; a failed call is shown as an error with its source, and the validator fails closed | `src/jira.ts`, `src/validator.ts` |
