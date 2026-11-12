# Privacy

Handoff Guard stores only work records, in Forge storage of the installation. It has no external service and no network egress (the manifest has no `permissions.external`).

## What is stored

- Decisions a person confirmed: title, scope, constraints, source reference (a work item key or a Confluence page URL), who confirmed and when.
- Handoff records: sender and receiver account ids, which decisions the receiver acknowledged, timestamps.
- Proposals waiting for a person (at most 5 per work item): title, scope, constraints, and the evidence quote (up to 300 characters) copied from a work item description, a visible comment or a linked Confluence page, with where it came from.

## What is not stored

- No chat. Rovo conversations are not saved by the app; the agent prompt forbids it.
- No copy of work item descriptions, comments or Confluence pages beyond the short evidence quote in a proposal. A confirmed decision does not copy the quote.
- No Teamwork Graph results: they are read at request time and not saved.

## Who sees what

- Reads of Jira and Confluence run as the current user, never as the app. Comments with restricted visibility are skipped.
- A Confluence quote is shown only after the page is re-read as the viewer; if they cannot open the page the quote is hidden and Confirm is disabled.
- Proposals and decisions are app-wide on the site: anyone who uses the app on that site can see a confirmed decision's title and source.

## Deletion

Uninstalling the app removes its Forge storage. Dismissing a proposal deletes it.
