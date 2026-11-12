# Privacy

Handoff Guard stores only work records, in Forge storage of the installation. It has no external service and no network egress (the manifest has no `permissions.external`).

## What is stored

- Decisions a person confirmed: title, scope, constraints, source reference (a work item key), who confirmed and when, and the evidence quote (up to 300 characters) it was confirmed from, so a marked decision already in the ledger is recognised.
- Handoff records: sender and receiver account ids, which decisions the receiver acknowledged, timestamps.
- Two texts a person types in the panel, both work-record text: the sender's contingency (at most 300 characters) and the receiver's read-back (at most 600 characters, replaced each time it is given). Neither is written by Rovo or by an action, and neither is chat.
- Proposals waiting for a person (at most 5 per work item): title, scope, constraints, and the evidence quote (up to 300 characters) copied from a work item description, a visible comment or a linked Confluence page, with where it came from.

## What is not stored

- No chat. Rovo conversations are not saved by the app; the agent prompt forbids it.
- No copy of work item descriptions, comments or Confluence pages beyond the short evidence quote in a proposal or confirmed decision. Page titles of linked pages are shown at request time and kept only inside that quote reference.
- No Teamwork Graph results: they are read at request time and not saved. Teamwork Graph people are shown at request time and not stored by the app; Rovo's own chat history is governed by Atlassian.

## Who sees what

- Reads of Jira and of Confluence pages linked to a work item run as the current user, never as the app. A page the person cannot open is not read, and the panel and the agent say so. Comments with restricted visibility are skipped.
- Proposals and decisions are app-wide on the site: anyone who uses the app on that site can see a confirmed decision's title and source.

## Deletion

Uninstalling the app removes its Forge storage. Dismissing a proposal deletes it; it may be proposed again.
