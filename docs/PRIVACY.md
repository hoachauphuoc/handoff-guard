# Privacy

Handoff Guard stores only work records, in Forge storage of the installation. It has no external service and no network egress (the manifest has no `permissions.external`).

## What is stored

- Decisions a person confirmed: title, scope, constraints, source reference (a work item key), who confirmed and when.
- Handoff records: sender and receiver account ids, which decisions the receiver acknowledged, timestamps.
- Proposals waiting for a person (at most 5 per work item): title, scope, constraints, and the evidence quote (up to 300 characters) copied from a work item description or a visible comment, with where it came from.

## What is not stored

- No chat. Rovo conversations are not saved by the app; the agent prompt forbids it.
- No copy of work item descriptions, comments beyond the short evidence quote in a proposal. A confirmed decision does not copy the quote.
- No Teamwork Graph results: they are read at request time and not saved. Teamwork Graph people are shown at request time and not stored by the app; Rovo's own chat history is governed by Atlassian.

## Who sees what

- Reads of Jira run as the current user, never as the app. Comments with restricted visibility are skipped.
- Proposals and decisions are app-wide on the site: anyone who uses the app on that site can see a confirmed decision's title and source.

## Deletion

Uninstalling the app removes its Forge storage. Dismissing a proposal deletes it; it may be proposed again.
