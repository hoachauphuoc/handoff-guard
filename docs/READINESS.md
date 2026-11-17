# Production readiness

What was tried before the code freeze, along four lines: security, conflicting flows, regression, user experience. Each row says how it was tried and what came out. "Test" means an automated test run by `powershell -File scripts/check.ps1`; "site" means seen on a Jira site with production installed (hoachauphuoc.atlassian.net with two accounts, one a project administrator and one not; one-atlas-hxpc.atlassian.net for Rovo and the workflow validator).

First round: 2026-11-17, production 3.55.0 to 3.59.0.

## 1. Security: the wrong person, and a payload that lies

| Case | How | Result |
|---|---|---|
| A person who is not a project administrator calls a resolver that changes decisions, drafts, project rules or project data (13 resolvers) | Test, `tests/resolvers.test.ts` "project administrator gate" | Refused with the same message, nothing written. 4 were covered before, 9 added |
| Export, and the two previews, by a non-administrator | Test, same block | Refused |
| Acknowledge (three ways) by a person who is not the receiver, contingency by a person who is not the sender, each naming someone else in the payload | Test, "what a caller sends is not trusted" | Refused, nothing written |
| Prepare with a forged sender, work item id or key in the payload | Test, same block | Sender and work item come from the session; the payload is ignored |
| A receiver id that is not shaped like an account id | Test | Refused before anything is read |
| A project rule switch that is not a plain true or false, or not in the catalogue | Test | Refused, nothing written |
| Delete project data without the project key typed | Test (existing) | Nothing deleted |
| Rovo actions that store something: a condition draft needs a project administrator; a read-back draft needs the receiver | Tests (existing), `tests/condition-actions.test.ts`, `tests/draftReceipt.test.ts` | Refused otherwise |
| Reads of work items | Read of the code | As the viewer everywhere, except the workflow validator, which reads one work item as the app (`src/validator.ts`, stated in `docs/SECURITY.md`) |
| The non-administrator account on the site | Site | No administrator buttons on the Decisions page or in the panel |
| Text a person typed shown to someone else | Read of the code | UI Kit renders it as text; a source link must be https |

Known and left: any person who can see a work item can have the agent store proposals on it (at most 5 per work item, and a proposal binds nothing until a project administrator confirms it).

## 2. Conflicting flows: two people, one record

Forge storage has no lock. A handoff record carries a save count (`rev`): a change made from an older copy is refused, and a new handoff raises the count so the old receiver's change cannot land on it (`src/store.ts`). This narrows the race to a few milliseconds; it does not close it.

| Case | How | Result |
|---|---|---|
| The sender takes the work back while the receiver's panel is open, then the receiver acknowledges | Site, OPS-7 and OPS-9 | Refused, nothing written. The message was a code name; fixed in 2b9f37c to say the handoff changed and to reload |
| A save made from an older copy of the record | Test, `tests/store.test.ts` | Refused |
| A new handoff, then a change made from the old record | Test, `tests/store.test.ts` | Refused |
| An acknowledgement that loses the race at the moment of saving | Test, `tests/resolvers.test.ts` "two people on one record" | The error reaches the receiver; no activity line claims it |
| A decision retired while the receiver is typing | Test, same block | Not acknowledged; the read-back is checked against what is in force at that moment |
| The due date changed between panel load and acknowledgement | Test, same block | The acknowledgement stores the date Jira has at that moment |
| 25 reassignments in 0.65 s | Site, OPS-7 to OPS-31 | All 25 handoffs recorded |
| Reassignment to the same receiver, to another, back to the sender | Tests (existing), `tests/reassign.test.ts` | Acknowledgements kept, dropped, or the record kept for the bounce, as documented |
| Two saves in the same few milliseconds | Not tried | Cannot be produced from two browsers; the limit is stated above and in `src/store.ts` |
| Activity lines written in a burst | Read of the code | The activity list has no save count; lines can be lost in a burst. It is a trail, not an input to any verdict |

## 3. Regression: what worked must still work

Smoke list, run on the site after a production deploy (about 5 minutes, page text only):

| # | Step | Last run | Result |
|---|---|---|---|
| 1 | Start page loads and shows the three steps | 3.59.0 | Pass |
| 2 | Decisions page loads with counts and handoffs in flight | 3.59.0, 31 open items | Pass, under 10 s |
| 3 | Panel on a work item with a handoff shows verdict and next step | 3.58.0 | Pass |
| 4 | A handoff appears after a reassignment | 3.58.0 | Pass |
| 5 | A read-back with a late date is refused, with the reason | 3.58.0, OPS-10 | Pass |
| 6 | A read-back inside the limit is accepted and the verdict is Clear | 3.58.0, OPS-10 | Pass |
| 7 | A due date moved after the acknowledgement makes it stale | 3.58.0, OPS-10 | Pass |
| 8 | Bounce autopsy finds the bounced handoffs | 3.58.0 | Pass: 2 of 4 Clear handoffs |
| 9 | Leaving the project lists what a person holds | 3.58.0 | Pass |
| 10 | Phone width (375): Decisions page has no sideways scroll | 3.59.0 | Pass |
| 11 | Workflow validator refuses, naming the findings | 3.55.0, MOBL-53 | Pass for the refusal only; letting a Clear handoff through is under "Not tried" |
| 12 | Rovo agent returns the rule check's verdict and findings | 3.55.0, MOBL-53 | Pass |

Not in this round: Replay on a date (the date picker does not take typed input from automation; last seen working by hand).

Mutation spot-check of the fixes of 2026-11-17 (the new condition inverted, the suite run, the file restored): `src/guide/next.ts`, `compareKeys`, the in-flight `missing` list: each caught by a test. The plain-sentence refusal in the resolvers was not caught at first; the tests now name the sentence and catch all three places.

## 4. User experience: found and fixed in this round

| Finding | Where | Fix |
|---|---|---|
| "The work item breaks a rule" for a handoff that only lacks a due date | Panel, next step | f1f08f8 |
| OPS-11 listed before OPS-8 | Decisions page, Leaving | acbd609 |
| An entry said only "2 decisions not acknowledged" when the work item also had no due date | Decisions page, handoffs in flight | da7ea6e |
| "Cannot acknowledge: not_receiver." | Panel, stale after the sender took the work back | 2b9f37c |
| "4 handoffs prepared" beside 29 handoffs in flight, because handoffs detected from a reassignment are not in the activity list | Decisions page, activity and counts | 03f00ea: the page says so |

Left, with the reason: the "Show everything: help, the full handoff, Rovo tools" button is cut at phone width, but its first two words say what it does; the context row on the work item's right side keeps its old value until the page is reloaded (Jira decides when it asks again).

## Not tried

- Three or more people on one work item (two accounts only).
- More than 100 open work items in a project (the cap is tested in code, `tests/cap.test.ts`, not seen on a site).
- A screen reader pass and outside testers (the owner's).
- The validator letting a Clear handoff through on production (needs the receiver's account on the site that has the validator).
