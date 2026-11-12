# Handoff Guard

A Forge app for Jira. When a work item is handed to someone else, rules check what is missing and which recorded decisions bind it. The verdict (Clear, Needs info, Blocked) always comes from plain code (`checkHandoff()`); Rovo only explains it and proposes decisions that a person must confirm.

## Install (for judges)

1. Install the app on a Jira site (development build: `forge install -e development --product jira`). Jira is the required app; Confluence is optional.
2. Open a work item. The Handoff Guard panel shows a getting-started checklist.
3. Optional: to let it read linked Confluence pages, also run `forge install -p Confluence -s <site> -e development` and grant consent when asked.
4. Optional: Teamwork Graph pages need a saved query registered by the app owner (see `docs/PROGRESS.md`); without it, only Jira remote links are used and the result says "Teamwork Graph returned nothing".

## Scopes

Every scope in `manifest.yml` and why it is there. A test fails if this table and the manifest differ. The app has no `permissions.external`: it sends nothing outside Atlassian.

| Scope | Reason |
|---|---|
| `read:jira-work` | Read the work item, its comments and its remote links as the current user. |
| `read:page:confluence` | Read a linked Confluence page as the current user, so a decision can be quoted from it. |
| `read:graph:issue:jira` | Teamwork Graph: start from the work item to find pages linked to it. |
| `read:graph:page:confluence` | Teamwork Graph: return the linked Confluence pages. |
| `read:graph:user:atlassian` | Teamwork Graph: return people connected to the work item (advisory, never a rule input). |
| `storage:app` | Store decisions, handoff records and proposals in Forge storage. |

## Rovo MCP server

The app has one `rovo:mcp` module ("Handoff Guard") that exposes the same four actions the Rovo agent uses: `check-handoff`, `list-binding-decisions`, `read-decision-source`, `propose-decisions`. External access is off by default. A site admin turns it on per installation in Atlassian Administration (Apps, Sites, the site, Connected apps, this app, Tools). The endpoint is `https://mcp.atlassian.com/forge/<app UUID>`. Tools run with the calling user's permissions. Over MCP there is no work item context, so pass `issueKey` such as `OPS-1`. `propose-decisions` only saves proposals; a person confirms them in the panel.

## Honesty notes

- The samples used to measure the rules are synthetic.
- The labels on those samples are written by a model (Muse), not by people.
- The measured figure is "agreement with Muse labels", not accuracy. Any number in this README must come from `npm run measure`; none is quoted here yet.

## Privacy and security

See `docs/PRIVACY.md` and `docs/SECURITY.md`.
