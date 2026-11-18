# Production readiness

What was tried before the code freeze, along four lines: security, conflicting flows, regression, user experience. Each row says how it was tried and what came out. "Test" means an automated test run by `powershell -File scripts/check.ps1`; "site" means seen on a Jira site with production installed (hoachauphuoc.atlassian.net with two accounts, one a project administrator and one not; one-atlas-hxpc.atlassian.net for Rovo and the workflow validator).

First round: 2026-11-17, production 3.55.0 to 3.59.0. Second round the same day, 3.60.0: the rows that were "not tried" after the first.

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

Forge storage has no lock, but a transaction can hold a condition on a custom entity. A handoff record and a project's decisions each carry a save count, kept in a `revision` entity; the value and the next count are written in one transaction that holds only while the count is still the one read (`src/store.ts`). A change made from an older copy is refused, a new handoff raises the count so the old receiver's change cannot land on it, and of two saves made in the same instant one is refused. The project rule switches and the activity list have a save count too (since 2026-11-18); a change to them only adds to what is stored, so a clash is redone on the newer copy instead of refused.

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
| Two saves started in the same instant, both read before either writes | Test, `tests/store.test.ts` | One is refused with "changed a moment ago … reload", the other is kept; the same for decisions, and for a save that lands between the read and the commit. On the development site (10.85.0, MOBL-58) a contingency was saved twice and the sample decisions removed and loaded again through the guarded writes |
| Three assignee changes sent at once on one work item, 8 work items | Site, OPS-40 to OPS-47 (two changes landed 0.1 s apart on OPS-44) | The stored handoff names the assignee Jira ended with, on all 8 |
| Activity lines written in a burst | Test, `tests/store.test.ts` "activity list" | Two lines appended in the same instant are both kept; a reset (project data deleted) is not undone by an append that read the old list. Until 2026-11-18 lines could be lost in a burst |
| Two rule switches in the same instant | Test, `tests/store.test.ts` "project rules" | Both stay on; a switch that meets another administrator's save is redone on top of it; after three clashes it fails with a message. On the development site (MOBL, 491027b) a switch turned on and off again was saved both times, with both Activity lines |

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
| 11 | Workflow validator refuses, naming the findings | 3.55.0, MOBL-53 | Pass |
| 11b | Workflow validator lets a Clear handoff through the same transition | 3.66.0, MOBL-58 (To Do to Architecture Review, through the project's default screen with nothing edited) | Pass, no message |
| 12 | Rovo agent returns the rule check's verdict and findings | 3.55.0, MOBL-53 | Pass |
| 13 | Replay on a date, the day picked by clicking the calendar | 3.59.0, OPS, 2026-11-16 | Pass: "No handoff differs", with the decisions it had to assume named |

Mutation spot-check of the fixes of 2026-11-17 (the new condition inverted, the suite run, the file restored): `src/guide/next.ts`, `compareKeys`, the in-flight `missing` list: each caught by a test. The plain-sentence refusal in the resolvers was not caught at first; the tests now name the sentence and catch all three places.

## 4. User experience: found and fixed in this round

| Finding | Where | Fix |
|---|---|---|
| "The work item breaks a rule" for a handoff that only lacks a due date | Panel, next step | f1f08f8 |
| OPS-11 listed before OPS-8 | Decisions page, Leaving | acbd609 |
| An entry said only "2 decisions not acknowledged" when the work item also had no due date | Decisions page, handoffs in flight | da7ea6e |
| "Cannot acknowledge: not_receiver." | Panel, stale after the sender took the work back | 2b9f37c |
| "4 handoffs prepared" beside 29 handoffs in flight, because handoffs detected from a reassignment are not in the activity list | Decisions page, activity and counts | 03f00ea: the page says so |

Left, with the reason: the context row on the work item's right side keeps its old value until the page is reloaded (Jira decides when it asks again).

## 5. More than 100 open work items

Tried on OPS with 106 open work items (75 synthetic ones added, then moved to Done), production 3.59.0 and 3.60.0.

| Page | Result |
|---|---|
| Decisions page | Loaded in about 9 s; says "the list was cut at 100, so the counts are at least these numbers"; 64 handoffs in flight listed |
| Leaving the project | Says "Only the first 100 open work items you can see were checked." |
| Bounce autopsy | Finding: only the first 50 stored handoffs were looked at, and "No Clear handoff bounced." was said without a caveat while two real bounces were out of reach. Fixed in 9f044b3: every stored handoff is looked at and only the Jira history reads are capped at 50; when the list was cut the page says an older bounce can be missing. Seen on 3.60.0: the counts add up (65 = 1 + 64) |
| Panel on a work item | Unaffected: it reads one work item |
| Export and delete | Not cut at 100 since 2026-11-18: they list every work item the app holds records for (a storage query) and ask Jira, as the administrator, which are in the project, open or done (bulk fetch, 100 per call). Cut at 2000 stored work items per site, and the delete message says so |

Left: the cut keeps the 100 that Jira returns first, so the newest work items are the ones dropped on the Decisions page and the least recently changed ones in the autopsy. Both pages say the list was cut.

## Critique of the read-back change (040cd9e)

One Gemini critique, 2026-11-17. Two points were about the rule itself: any date in a read-back addresses a date limit, and one addressed constraint addresses the whole decision. Both are as designed: the read-back shows that a decision was addressed, a later date is refused as a contradiction by the next check, and the panel says "addressed, not understood". No change. The other points were about wording for a reader of a pitch, which this diff is not.

## Independent review, 2026-11-17

An outside technical review read the code at 4d4f7e0 and set ten acceptance tests. Where each stands:

| Test | Where it stands |
|---|---|
| T01 A late date in a read-back is refused, then accepted once fixed | Site, smoke rows 5 and 6 |
| T02 No handoff to oneself; only the receiver acknowledges; only an administrator records a decision | Tests (`same_person` in `tests/checkHandoff.test.ts`; section 1 above); site, section 1 |
| T03 An acknowledgement goes stale when the work item changes | Site, smoke row 7 (due date); labels and components in `tests/drift.test.ts`; a new or replacing decision has no acknowledgement until read back |
| T04 Fields edited on the transition screen | Code (1c00119): due date, labels, description and components in `modifiedFields` are applied before the check (test). Site, 2026-11-18, production 3.62.0, MOBL-58 with the project's default screen put on the transition for the test: the description emptied on the screen went through, so the check used the stored description. A development build that showed the payload's keys in its refusal found why: Jira sends `modifiedFields` at the top of the payload, and `transition` holds only `from` and `to`; the code read it from `transition`, as the Forge docs show. Fixed to read both places; on development 10.90.0 and production 3.66.0 (1b9a4a8) the same edit is refused with "The description is empty.", the work item stays as it was, and the same transition with nothing edited goes through. The screen and the development validator were taken off again |
| T05 Two people saving at once | Fixed: handoff records and decisions are written with a conditional transaction, so one of two simultaneous saves is refused (section 2, tests in `tests/store.test.ts`). The rule switches and the activity list are written under a save count too, and a clash is redone (after the follow-up review, see below) |
| T06 Jira or storage failing | Tests (ba122c0): both validators refuse. What an administrator does is in `docs/SECURITY.md`, "When the validator cannot check". Drill run by the author on 2026-11-18 (production 3.66.0, MOBL): validator removed, a not-Clear item moved through, validator added back, both changes in Jira's audit log, the item listed under "Handoffs in flight", the same move refused again. Not done with an operations team |
| T07 The if-then rule on its own, contingency empty | Fixed in a606da7: Needs info, "the sender has not written a contingency" |
| T08 Export and delete beyond 100 open items or on done items | Fixed: both reach every work item of the project the administrator can see, open or done (section 5, `tests/resolvers.test.ts`, `tests/held-items.test.ts`; on development 10.90.0 Export ran through the storage query and Jira's bulk fetch and listed MOBL-53 and MOBL-58). A work item the administrator cannot see, or one deleted from Jira, keeps its data until the app is uninstalled, as the Decisions page and `docs/PRIVACY.md` say |
| T09 MCP calls by people with different roles | Seen 2026-11-18 on production from Claude Code, through the app's own endpoint `https://mcp.atlassian.com/forge/<app id>` after a site administrator switched on "Expose tools to MCP-compatible apps" (the general Atlassian MCP server does not list the app's tools). The caller was a MOBL project administrator who receives MOBL-58 and does not receive MOBL-53. All eight tools answered. Read only: `check-handoff` (MOBL-53 Needs info with three findings, MOBL-58 Clear), `list-binding-decisions`, `read-decision-source`, `gather-handoff-context` and `check-condition` (0 in force over 51 open items; `priority = Highest` matches 2). Roles: `draft-receipt` refused on MOBL-53 ("Only the receiver ... Nothing was saved"); on MOBL-58, where the caller is the receiver, it ran the rule check and refused a date after 2026-12-31, saving nothing. `draft-condition` stored a draft for the administrator and `propose-decisions` stored one proposal; both were removed afterwards. Found and fixed on the way: an outside MCP call carries the caller only in `context.principal.accountId`, so `draft-condition` and `draft-receipt` first refused everyone as "not signed in" (commit "read the caller from context.principal too"). Since 3b484d5 the platform's field is read first and the call's own input only when the platform gives none, so a client cannot name another person; after that deploy `draft-receipt` on MOBL-53 was still refused for the non-receiver and `check-handoff` on MOBL-58 still answered Clear. A forged `context` field could not be sent from this client, whose tool schema allows no extra fields. Same day, same caller after the owner changed their MOBL role from Administrators to Member (not in any administrator group): `check-handoff` answered on MOBL-58 (Clear) and said "Jira has no work item MOBL-9999 that you can see" for a key it cannot open; `draft-condition` was refused ("Only an administrator of project MOBL can draft a condition. Nothing was stored.") and `check-condition` still listed 0 conditions in force; `draft-receipt` was refused on MOBL-53 (not the receiver) and stored an unsigned draft on MOBL-58 (the receiver), which acknowledges nothing; `propose-decisions` stored one proposal on MOBL-58 and the verdict stayed Clear. Found on the way: the first `draft-condition`, made within minutes of the role change, was still stored, because Jira kept answering "Administer projects: yes" for a few minutes; a later call with the same caller was refused. The app asks Jira on every call and keeps no copy, so a removed administrator keeps that right only for as long as Jira's own answer lags. The stored condition draft and the proposal bind nothing and wait for an administrator to discard them (Decisions page, panel); the receipt draft stays offered to the receiver until they sign it, and it changes nothing until then. The role was given back after the test |
| T10 An outside pilot | Not done; the protocol is in `docs/PILOT.md` |

## Follow-up review, 2026-11-18

The same reviewer checked the answers at 866a3a0 against the code, the tests and CI (a source and documentation review, not an audit of a site). Their reading: all six findings have a fix, a test, a drill by the author, or a stated limit; T01 to T08 have a result; T09 and T10 are not done. Their verdict was positive for this contest entry, conditional for a narrow trial (only where the Jira administrator knows the recovery steps and the data limits), and not yet recommended for broad use on critical work.

Closed after it: the rule switches and the activity list now use the save count (section 2), which was their residual point 2.

Left, each stated where a reader meets it: a Jira filter is answered on the stored work item and other screen fields are read as stored (T04, `docs/LIMITS.md`); transitions made while the validator is removed are not checked (`docs/SECURITY.md`); export and delete stop at 2000 stored work items and miss hidden or deleted ones, and there is no delete for one person's data (`docs/PRIVACY.md`); the validator reads as the app, the panel as the person (`docs/SECURITY.md`); the read-back check is a fixed set of patterns and the figures are agreement with labels (README). T09 by a caller without project administration was run after the next review (Rev. 03, below); T10 needs outside teams.

## Second follow-up review (Rev. 03), 2026-11-18

The same reviewer checked the answers at 0ea60c4, again from the code, the docs and CI, not on a site. They confirmed the save-count fix for the rule switches and the activity list and the caller fix for outside MCP calls, found no serious new problem for the contest entry, and asked for one more test: T09 by a caller who is not a project administrator. It was run the same day (T09 above). Still open: T10, a recovery drill with an operations team, and the limits listed under the follow-up review.

## Not tried

- Three or more people on one work item (two accounts only).
- A screen reader pass and outside testers (the owner's).
