# Privacy

Handoff Guard stores only work records, in Forge storage of the installation. It has no external service and no network egress of its own (the manifest has no `permissions.external`); if a site administrator enables the Rovo MCP server, the client that administrator connects receives tool results under the calling user's permissions. The Rovo agent's chat, and the work item text it reads, go through Rovo, which Atlassian governs. It uses Forge LLMs, which runs the model on Atlassian's platform (see below).

## What is stored

- Decisions a person confirmed: title, scope, constraints, source reference (a work item key), who confirmed and when, and the evidence quote (up to 300 characters) it was confirmed from, so a marked decision already in the ledger is recognised.
- Handoff records: sender and receiver account ids, which decisions the receiver acknowledged, timestamps.
- With each acknowledgement, a fingerprint of the work item at that moment: the due date, labels and components as values, and the summary and description only as a short hash (no text). It lets the panel say what changed since the receiver acknowledged.
- Two texts a person types in the panel, both work-record text: the sender's contingency (at most 300 characters) and the receiver's read-back (at most 600 characters, replaced each time it is given). Neither is written by Rovo or by an action, and neither is chat.
- An activity list per project (the latest 300 entries): the action (for example "prepared a handoff", "had a read-back refused"), the account id of the person, the time, and the work item key or decision id. No text anyone typed is kept in it. It is shown on the Decisions page and the monthly counts are computed from it.
- When the receiver acknowledges with typed answers instead of a read-back: one value per slot, a date or "yes". No free text.
- A draft of typed answers Rovo made for the receiver (the same values, per work item), removed when the receiver sends the answers or the project's data is deleted.
- Per project, which of the two optional rules a project administrator switched on (two true/false values).
- Proposals waiting for a person (at most 5 per work item): title, scope, constraints, and the evidence quote (up to 300 characters) copied from a work item description, or a visible comment, with where it came from.

## What is not stored

- No chat. Rovo conversations are not saved by the app; the agent prompt forbids it.
- No copy of work item descriptions or comments beyond the short evidence quote in a proposal or confirmed decision.
- Conditions drafted with Rovo are stored per project (`condition-drafts:<project>`, at most 10): a title, the Jira filter (JQL), the decision it would replace, who asked and when. Nothing of the chat is stored with it. A draft binds nothing until a project administrator confirms or discards it on the Decisions page.
- No Teamwork Graph results: they are read at request time and not saved. Teamwork Graph people are shown at request time and not stored by the app; Rovo's own chat history is governed by Atlassian.

## Forge LLMs

When a read-back is refused because it contradicts a decision, the app sends the read-back and the code's refusal reasons (which name the decision titles and values) to Forge LLMs and shows the one-sentence answer beside the reasons. Nothing else is sent. The answer is not stored. Forge LLMs runs the model inside Atlassian's platform with no data egress, and the app keeps the Runs on Atlassian eligibility (Atlassian: Forge LLMs API). Atlassian applies its own moderation to these requests.

## Who sees what

- Reads of Jira run as the current user. The one exception is the workflow validator, which reads the work item as the app (see `docs/SECURITY.md`). Comments with restricted visibility are skipped.
- Proposals and decisions are stored once per site. A decision's title and source are shown where it can bind: in its project, or on its work item. A label decision confirmed before 2026-11-13 carries no project and is shown in every project of the site until superseded.

## Deletion

Uninstalling the app removes its Forge storage. A project administrator can also export everything the app holds for a project as JSON from the Decisions page, and delete it there (decisions, condition drafts, the activity list, and the handoffs, drafts and proposals of up to 100 open work items that administrator can see); the administrator types the project key to confirm. Records on closed work items or items past that cap, and the project's rule switches, stay until the app is uninstalled. Account IDs are kept in handoff records and in the activity list (the latest 300 events), and deleting one person's data on request is not supported; contact us through GitHub issues. Dismissing a proposal deletes it; it may be proposed again.
