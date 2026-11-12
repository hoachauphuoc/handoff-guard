# Design: I-PASS handoff (idea 11). Design only, no code

Status: for review. No rule semantics change until this is reviewed. Written 2026-11-12 against the code at HEAD of that day.

I-PASS has five parts: illness severity, patient summary, action list, situation awareness and contingency, synthesis by receiver (AHRQ TeamSTEPPS). The mapping below keeps every part as plain code over the handoff record. Rovo may help word things; a person decides.

## 1. Severity (Stable, Watcher, Unstable)

Rule: severity is computed from the findings `checkHandoff()` already returns. No new finding feeds it.

| Findings present | Severity | Verdict today |
|---|---|---|
| none | Stable | clear |
| only `info_needed`: `no_sender`, `empty_description`, `no_due_date`, `invalid_due_date`, `invalid_constraint`, `decision_not_acknowledged` (also when stale) | Watcher | needs_info |
| any `block`: `no_receiver`, `same_person`, `contradicts_decision` | Unstable | blocked |

Plain finding, for review: with the current findings this is a relabelling of the verdict (clear, needs_info, blocked). A second scale beside the verdict adds a second thing to read and conflicts with "no new verdict word". Recommendation: do not add a stored or separate severity. Show the I-PASS name next to the verdict in the panel ("Blocked (I-PASS: Unstable)") and in the README mapping table, computed by one pure function `severityOf(result.verdict)`. If a later finding should make a handoff Unstable without blocking, that is a rule change and needs its own review.

## 2. Action list

Derived, never typed: one action per finding, in a fixed order (block first, then by rule order), each with an owner chosen by rule.

| Finding | Owner | Action text source |
|---|---|---|
| `no_receiver`, `same_person`, `no_sender` | sender | the finding message |
| `empty_description`, `no_due_date`, `invalid_due_date` | sender | the finding message plus the existing hint (`src/guide/hints.ts`) |
| `contradicts_decision` | sender | the finding message plus the Fix Advisor sentence for that decision (`suggestFixes`), advisory wording kept |
| `invalid_constraint` | the person who confirmed the decision (`confirmedBy`), else a Jira admin | the finding message |
| `decision_not_acknowledged` (not given or stale) | receiver | the finding message |

Pure function `actionList(result, decisions, fixes)` returns `{ owner: "sender" | "receiver" | "decision owner", text, decisionId? }[]`. It reads findings only, so it cannot disagree with the verdict, and an empty list is exactly the Stable case. Owners are roles; the panel shows the people from the record.

## 3. Contingency

I-PASS asks the sender for "if X, then Y" for what may go wrong. Plain code can check only form: present, 20 to 300 characters, and matching `/\bif\b.+\bthen\b/i`. It cannot judge whether the contingency is wise.

Open question for the reviewer, with a recommendation:
- Option A: a new finding `missing_contingency` (info_needed), raised when the handoff is Unstable. An Unstable handoff is already blocked, so the finding would add text but no change of verdict, and the handoff cannot move until the block is resolved anyway.
- Option B (recommended): the contingency is an optional record field written by the sender in the panel and shown to the receiver; the check is only "if present, it has the if-then form" as an advisory (never a finding). It reaches the receiver in the brief. Requiring it for Unstable adds nothing the block does not already do.

## 4. Read-back (synthesis by the receiver)

What plain code can establish: that for each binding decision the receiver wrote text that mentions something specific to it. Rule: for a decision with constraints, the read-back text for that decision, normalised the way the rules compare (trim, lower case), contains at least one of its constraint values (the date, the label or the component name) or the decision's title; for a decision with no constraints, any text of at least 20 characters. Length 20 to 300 characters.

What it cannot establish: that the receiver understood the decision or agrees with it. A person can paste the constraint value and understand nothing. The README and the panel must say "checks that each decision is addressed, not that it was understood".

Where it sits: acknowledging a decision takes a read-back string for that decision. `acknowledge()` refuses an empty or non-addressing read-back with a plain reason ("Your read-back does not mention the label legal-reviewed or the title"). Rovo may draft a read-back in chat; it is only text until the person submits it, and the check is code.

## 5. Record change and stored records

`HandoffRecord` gains, all optional:
- `protocol?: 1` marks a record prepared under this design.
- `contingency?: string`.
- `readBack?: Record<decisionId, string>`.

Stored records without them behave exactly as today: no read-back is demanded of acknowledgements already given, `acknowledge()` for a record without `protocol` keeps its current behaviour (no read-back required), and the panel says "Acknowledged before read-back existed" instead of claiming it was checked. A new `prepareHandoff` sets `protocol: 1`. Re-preparing replaces the record, so read-backs never carry to a new receiver (as acknowledgements do not today). A stale acknowledgement (handoff drift) needs a new read-back.

## 6. Principles touched and the test that guards each

| Principle | What this design touches | Guard |
|---|---|---|
| 1. Rules decide, the model words | severity, action list, read-back check are pure functions; Rovo drafts text only | test that `severityOf`, `actionList` and the read-back check import nothing from Forge, and that a read-back typed by Rovo with no person's submit changes no record |
| 2. A clear verdict never carries a finding | any new finding must be `info_needed` at most and only when the check applies | the existing property test over samples extended: Stable has an empty action list, and an empty action list means Stable |
| 3. No silent substitution | records without `protocol` | test that an old record shows the "before read-back existed" text, never a pass |
| 4. No chat storage | read-back and contingency are work-record text written by a person, 300 characters at most | update `docs/PRIVACY.md`; test that the cap holds and that Rovo's text is never saved by an action |
| 5. README figures only from `scripts/measure` | I-PASS numbers are from clinical studies | test (like `marketplace.test.ts`) that the README keeps the I-PASS sentence next to its citation and does not put it in the measured-figures section; `npm run measure` is unchanged unless samples gain read-backs, which they would not |

## 7. What the README may and may not claim

May: Handoff Guard follows the structure of the I-PASS handoff protocol (severity, summary, action list, contingency, receiver synthesis) over Jira work items. May cite, with the source, that I-PASS in hospitals was linked to fewer medical errors and preventable adverse events (NEJM 2014, 23% and 30%; a 32-hospital follow-up, 47% fewer handoff-related adverse events). May say the read-back checks coverage, not understanding.

May not: say or imply this app reduces errors, harm or bug reassignments; reuse the percentages as a result of this app; call the app clinically validated or an I-PASS implementation endorsed by the I-PASS Institute; put any I-PASS figure beside the agreement-with-Muse-labels figure. The percentages are from clinical studies in hospitals. The software-engineering evidence we have (about half of bugs are reassigned, bug-tracker studies) is about the problem, not about this app.

## 8. Applied on paper to the stored handoffs

I could not read the stored records from here (Forge storage has no local read). This uses only what the owner session reported from the dev site, and marks the rest as unknown.

MOBL-53 (reported on 7.8.0: verdict Blocked; first finding "No due date is set."; binding decisions exist, including project-wide ones):
- Severity: Unstable, because the verdict is Blocked, so some finding has severity `block` (almost certainly `contradicts_decision`; not read here).
- Action list: by the table, at least "sender: No due date is set" with the due-date hint; one "sender" action per contradiction (with its Fix Advisor sentence); one "receiver" action for each binding decision not yet acknowledged. The full list needs the stored findings.
- Contingency: none stored. Under option B the panel would show "no contingency written" and nothing else changes.
- Read-back: the record predates this design, so no `protocol`: the panel would say "acknowledged before read-back existed" for any acknowledgement already given.

TD-1 (reported: "Clear. No findings."; advisory "The assignee is not the receiver of the prepared handoff."):
- Severity: Stable. Action list: empty, which matches Stable.
- Read-back: old record, grandfathered; if TD-1 were re-prepared under this design, the receiver would need a read-back for each binding decision before the handoff stays Clear.
- The assignee advisory stays an advisory; it is not a finding and does not touch severity.

Result of the exercise: on these two items the severity chip would equal the verdict word, which is the point made in section 1. The new information is the action list with owners and, for new handoffs, the read-back.

## 9. For the reviewer to decide
1. Severity as a computed label of the verdict only (recommended), or a separate scale.
2. Contingency: option A or B.
3. Read-back rule: constraint value or title mentioned; is that strict enough, too strict (a paraphrase of "no legacy email" without the component name would fail)?
4. Whether read-back is required for every binding decision or only the ones with constraints.
5. The README sentence in section 7, word for word.
