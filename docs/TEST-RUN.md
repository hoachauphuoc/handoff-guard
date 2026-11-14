# Test run before sharing on the Atlassian Community

Date: 2026-11-14. Site: the owner's demo site, one account (site admin). Run by Claude in the built-in browser, on test item MOBL-58 ("Handoff Guard test"), created for this run and moved to Done afterwards. The demo items MOBL-53 and TD-1 were not changed; two Rovo proposals that test F created on them in the production install were dismissed.

Production was 3.6.0 during the run. Steps B and D ran on the development install, which holds three fixes production does not have yet (see "Fixed during the run").

| Step | What was checked | Result |
| --- | --- | --- |
| A | Install link consent screen: four permissions, nothing for Confluence | Pass |
| B1 | Panel opens from "View app actions"; the loading text shows | Pass (development) |
| B2 | Load sample decisions: 4 stored decisions for this project | Pass (development) |
| B3 | Prepare handoff to yourself: Blocked, "Sender and receiver are the same person", two acknowledgement findings | Pass (development) |
| B4 | Show help shows a hint beside each finding | Pass (development) |
| B5 | Read-back with a January 2027 date is refused with the code's reason and a model-written sentence | Pass (development) |
| B6 | Read-back with December 2026 is accepted; both decisions read "Acknowledged." | Pass (development) |
| B7 | A later edit shows the drift note; stale acknowledgement after a due-date change | Partly: the note shows after a description edit. The MOBL and TD layouts have no Due date field, so the due-date path was not tried |
| C | Three paths switch; Gather handoff context; Explain with Rovo; proposal confirm and dismiss | Pass. Teamwork Graph said "returned nothing", one of the named states |
| D1 | Decisions list shows | Pass |
| D2 | Supersede refused for a decision you did not confirm | Not testable with one account: every decision here was stored by this account. Covered by unit tests |
| D3 | Replay: placeholder "Pick a date"; picking 2026-11-01 gives a result | Pass after fix 43de8b6 (before it, the notes named other projects' decisions) |
| D4 | Handoffs in flight lists MOBL-58 | Pass (Blocked) |
| D5 | Leaving the project lists open items and their state | Pass |
| E | Moving MOBL-58 to In Progress while Blocked is refused | Pass: "Transition failed. Sender and receiver are the same person. No due date is set." The status stayed To Do |
| F | 10 Rovo prompts on the production agent | 8 / 10, see `docs/ROVO-TESTS.md` |

## Fixed during the run

Each fix is its own commit, checked with `scripts/check.ps1` and deployed to development. Production gets them on the owner's order.

- d62132f: sample decisions are stored per project, so loading them in a second project no longer moves the first project's samples, and the panel counts only this project's decisions.
- a296eab: an old site-wide label decision no longer hides "Load sample decisions" in a project without samples.
- 43de8b6: the Replay notes list only this project's decisions.
- 87b9290: the agent's action inputs no longer carry an example key ("OPS-1") that the agent copied when no work item was open; a missing key now asks the user which work item. Rovo test 1 passes on development after it.

## Open findings

- Rovo test 7: the agent listed three proposals while the action saved one (the panel shows one). The words about binding were right. Not fixed; the likely cause is a second propose call, which replaces the saved set.
- The validator on the shared MOBL/TD workflow belongs to the development install (its refusal used the development handoff record). A tester's own site uses their own install, so this affects only filming with production on this site.
- The development Decisions page shows "Launch work needs legal review" twice: a site-wide label decision left from an older version and this project's sample. A fresh install does not have the old one.

## Not testable here

- The Clear verdict and an acknowledgement by a real second person (one account).
- A user who is not a site admin.
- A site without Rovo.
- MCP from an external client.
- A fresh site installing for the first time.
- Stale acknowledgement after a due-date change (no Due date field on these layouts).
