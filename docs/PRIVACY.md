# Privacy

Handoff Guard stores only work records, in Forge storage of the installation. It has no external service and no network egress of its own (the manifest has no `permissions.external`); if a site administrator enables the Rovo MCP server, the client that administrator connects receives tool results under the calling user's permissions. The Rovo agent's chat, and the work item text it reads, go through Rovo, which Atlassian governs. It uses Forge LLMs, which runs the model on Atlassian's platform (see below).

## What is stored

- Decisions a person confirmed: title, scope, constraints, source reference (a work item key), who confirmed and when, and the evidence quote (up to 300 characters) it was confirmed from, so a marked decision already in the ledger is recognised.
- Handoff records: sender and receiver account ids, which decisions the receiver acknowledged, timestamps.
- With each acknowledgement, a fingerprint of the work item at that moment: the due date, labels and components as values, and the summary and description only as a short hash (no text). It lets the panel say what changed since the receiver acknowledged.
- Two texts a person types in the panel, both work-record text: the sender's contingency (at most 300 characters) and the receiver's read-back (at most 600 characters, replaced each time it is given). Neither is written by Rovo or by an action, and neither is chat.
- An activity list per project (the latest 300 entries): the action (for example "prepared a handoff", "had a read-back refused"), the account id of the person, the time, and the work item key or decision id. No text anyone typed is kept in it. It is shown on the Decisions page and the monthly counts are computed from it.
- When the receiver acknowledges with typed answers instead of a read-back: one value per slot, a date or "yes". No free text.
- A draft of typed answers Rovo made for the receiver (the same values, per work item), removed when the receiver sends the answers, or when the project's data is deleted (open work items only, the first 100).
- Per project, which of the three optional rules a project administrator switched on (three true/false values).
- Conditions drafted with Rovo, per project (at most 10): a title, the Jira filter (JQL), the decision it would replace, who asked and when. Nothing of the chat is stored with it. A draft binds nothing until a project administrator confirms or discards it on the Decisions page.
- Proposals waiting for a person (at most 5 per work item): title, scope, constraints, and the evidence quote (up to 300 characters) copied from a work item description, or a visible comment, with where it came from.

## What is not stored

- No chat. Rovo conversations are not saved by the app; the agent prompt forbids it.
- No copy of work item descriptions or comments beyond the short evidence quote in a proposal or confirmed decision.
- No Teamwork Graph results: they are read at request time and not saved. Teamwork Graph people are shown at request time and not stored by the app; Rovo's own chat history is governed by Atlassian.

## Forge LLMs

When a read-back is refused because it contradicts a decision, the app sends the read-back and the code's refusal reasons (which name the decision titles and values) to Forge LLMs and shows the one-sentence answer beside the reasons. Nothing else is sent. The answer is not stored. Forge LLMs runs the model inside Atlassian's platform with no data egress, and the app keeps the Runs on Atlassian eligibility (Atlassian: Forge LLMs API). Atlassian applies its own moderation to these requests.

## Who sees what

- Reads of Jira run as the current user. The one exception is the workflow validator, which reads the work item as the app (see `docs/SECURITY.md`). Comments with restricted visibility are skipped.
- Decisions are stored per project, proposals per work item. A decision's title and source are shown where it can bind: in its project, or on its work item. A label decision confirmed before 2026-11-13 carries no project and is shown in every project of the site until superseded.

## Storage keys

Every write goes through `src/store.ts`. One row per kind of key; `<project>` is the project key in lower case, `<item>` the work item id.

| Key | Holds | Export | Delete |
|---|---|---|---|
| `decisions:<project>` | Confirmed decisions, with a save count | Yes | Yes (emptied, not removed, so the old key below is not read again) |
| `decisions` (old, site-wide) | Decisions saved before 2026-11-13; only read now | The project's part, only while `decisions:<project>` does not exist yet | Yes, the project's part; a label decision with no project stays, as it belongs to every project |
| `handoff:<item>` | The handoff record, its acknowledgements, fingerprints, contingency and read-back | Yes, first 100 open items | Yes, first 100 open items |
| `proposals:<item>` | Proposals waiting for a person | Yes, first 100 open items | Yes, first 100 open items |
| `receipt-draft:<item>` | Typed answers Rovo drafted for the receiver | Yes, first 100 open items | Yes, first 100 open items |
| `condition-drafts:<project>` | Conditions drafted with Rovo | Yes | Yes |
| `settings:<project>` | The three optional rule switches | Yes | Yes |
| `audit:<project>` | The activity list | Yes | Cleared; one new entry records the deletion |
| `rev:<key>` (entity `revision`) | The save count of a handoff record or of a project's decisions, so two saves from one copy cannot both land | No (a number, no content) | With the handoff record it belongs to; a project's count stays, as its decisions are emptied, not removed |

## Deletion

Uninstalling the app removes its Forge storage. A project administrator can also export what the app holds for a project as JSON from the Decisions page, and delete it there; the administrator types the project key to confirm. The table above says what each covers. Records on closed work items, or on open ones past the first 100 that administrator can see, stay until the app is uninstalled. Account IDs are kept in handoff records and in the activity list (the latest 300 events), and deleting one person's data on request is not supported; ask through the repository's GitHub issues, and do not post personal data there (issues are public). Dismissing a proposal deletes it; it may be proposed again.
