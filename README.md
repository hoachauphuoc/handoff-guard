# Handoff Guard

[![check](https://github.com/hoachauphuoc/handoff-guard/actions/workflows/check.yml/badge.svg)](https://github.com/hoachauphuoc/handoff-guard/actions/workflows/check.yml)

**The read-back gate for Jira handoffs:** the receiver restates the decisions that bind the work, and plain code refuses a restatement that contradicts one.

For software teams whose Jira work items change owner while the work is still open: release work passed between engineers, on-call rotation, cover for someone on leave. The decisions that bind such work often live in one person's head, a page or a comment, and the next person finds them late.

A Forge app for Jira. When a work item is handed to someone else, the receiver restates each recorded decision that binds it, and plain code refuses a restatement that contradicts one in ways it can detect, for example a date after a recorded limit or a required label described as skipped. It does not catch every contradiction or prove understanding. Rules also check what is missing from the work item. The verdict (Clear, Needs info, Blocked) always comes from plain code (`checkHandoff()`); Rovo only explains it and proposes decisions that a person must confirm.

## Try it in 3 minutes (one account)

What you will see: the Handoff Guard panel on a work item refuses a read-back that contradicts a team decision, says why, and accepts a corrected one. Four steps, one account, nothing written to Jira.

Use an account that is a project administrator of the Jira project. Load sample decisions, confirming, adding and superseding a decision need Jira's "Administer projects" permission.

1. Install from the installation link in the Devpost submission and open any work item. Click the apps icon under the summary ("View app actions"), then **Handoff Guard**. The panel opens on one card, "Your next step: Load the demo rules". If you cannot find the panel, open **Apps** in Jira's top bar and choose **Handoff Guard: start here**: it names the three steps and has a button for each.
2. Click **Load sample decisions (demo)**. You should see "4 stored decisions for this project". Nothing is written to Jira.
3. Under "Practice read-back" (beside your next step; if the work item already has a handoff, click **Show everything** to see it), type `Work ships by the end of 2026: I will ship on 15 January 2027. Stop using the legacy billing component: understood.` and click **Try a read-back (practice, nothing is saved)**. You should see "This read-back would be refused:", the code's reason about the 2026-12-31 limit, and one sentence labelled as written by a model.
4. Change the date to `15 December 2026` and click again. You should see "Would be accepted" and "No contradiction found in the dates, labels and components the code reads."

That refusal is the point of the app: the receiver restates each decision, and plain code refuses a restatement that contradicts one in ways it can detect. It does not catch every contradiction or prove understanding. The practice check stores nothing and gives no verdict. A real handoff, with a second user as receiver, reaches Clear through the same check; the 10-minute path is in `docs/DEVPOST.md`.

## Install (for judges)

1. Install the app on a Jira site from the installation link in the Devpost submission. The app is Jira-only: it declares no Confluence scope and no multi-app compatibility, so it installs on any single Jira site. Developers working on the app install their own build with `forge install -e development --product jira`.
2. Open a work item, click the apps icon under the summary (tooltip "View app actions") and choose **Handoff Guard**. The panel opens on one card, "Your next step"; **Show everything** shows the rest, including a guide with three paths: "New to this project", "Handing over this work" (the default) and "Leaving the project". A step-by-step path of about 10 minutes, with the exact read-backs to type, is in `docs/DEVPOST.md` ("Testing instructions"). One account is enough to see a refusal and an accepted read-back; reaching Clear needs a second user as receiver.
3. Teamwork Graph needs no setup from you. If it returns nothing, was not asked, or could not be read (one retry, then the app says so), the app says which, and no rule depends on it.

## Bounce autopsy and project rules

On the Decisions page, **Look for bounced handoffs** reads the Jira history of the project's work items changed in the last 60 days that have a stored handoff. A handoff counts when it was Clear at the receiver's last acknowledgement; it bounced when, within 7 days, the work item went back to the sender or left a Done status. For the bounced ones the page counts what the stored handoff lacked, from a fixed list, next to the same count for the handoffs that did not bounce. It is a count, not proof of a cause, and no model takes part.

Governance: a project administrator can release rules from a fixed catalogue of three: require a contingency from the sender, require it in the "if … then …" form, and require the work item to be assigned to the receiver. A rule is a draft until released; before releasing, the page shows how many handoffs that are Clear today would need information. A released rule is part of the same rule check: the handoff is Needs info until it is met, in the panel, the workflow validator, the context row and the Rovo actions. Every release or retirement is written to Activity. All are drafts as installed; administrators cannot write their own rules, so code stays the decider. The verdict "then" uses the decisions as they stood at that time and the work item as it is now; Replay on a date does not apply the project rules.

Beside the free-text read-back, the receiver can acknowledge with **typed answers**: one per constraint of each binding decision, a date for a date limit and a confirmation for a label or component that must be kept or kept off. Plain code compares each value (a date after the limit is refused with both dates) and only those values are stored. Rovo can draft them when the receiver asks in chat (`draft-receipt`): code checks the values and refuses a draft that breaks a decision, and an accepted draft is stored unsigned. It acknowledges nothing until the receiver opens the panel, fills it in from the draft and sends it, where the same check runs again.

A decision that says the opposite of one in force for the same work (a required label against the same label forbidden, or another date limit) cannot be saved beside it: it is saved only together with superseding the older one.

## Decisions for any business rule

What a team decides is data; the code knows only the shape of a decision. Besides a date limit and a required or forbidden label or component, a decision can be one of three kinds:

| Kind | Example | Who decides whether it is met |
|---|---|---|
| A Jira filter (JQL) the work item must match | `priority = Highest`, a custom field, a status | Jira runs the filter for that one work item; plain code reads yes or no. When Jira gives no answer, the finding says the rule could not be checked and the verdict is never Clear on a guess. |
| A commitment, with nothing to check | "Tell legal before release" | The receiver confirms it by name; code records who and when. |
| A link to where it was decided | a page, a ticket, a contract | Nobody: it is shown beside the decision and never opened or read by the app. |

A filter is refused at save time when Jira cannot parse it (with Jira's own message) or when it sorts. Before saving, **Check** counts the open work items it would contradict.

**Rovo as the administrator's JQL assistant.** JQL is hard to write, so a project administrator can ask the Handoff Guard agent in Rovo, for example "Would 'only Highest priority can go to review' work in MOBL?". Rovo writes the filter and the sentences; code does the rest:

- `check-condition` lists the filters in force with how many open work items match each, or, for a new filter, asks Jira whether it can run (Jira's errors word for word) and counts the open work items that match and do not. It reads as the person asking and stores nothing.
- `draft-condition` stores a draft, for a project administrator only (at most 10 per project). A draft binds nothing. It appears on the Decisions page under "Drafted with Rovo (not in force)", where an administrator confirms it, with the same checks as the form, or discards it. Both are written to Activity.

Without Rovo, the form on the Decisions page does all of this by hand.

## Accessibility

Every text box in the panel has a label, the verdict and each step carry a word as well as a colour, and a refusal is shown in an error box with its reasons as text. The panel has not been tested with a screen reader or with the keyboard alone.

## Joining, handing over, leaving

The panel's checklist has one path for each moment. "New to this project" points a newcomer at the decisions that bind the work item, the handoff brief and the project's Decisions page. "Handing over this work" is the handoff itself. "Leaving the project" leads to a section of the same name on the Decisions page: pick a person and it lists their open work items with the state of each handoff, the handoffs they have not acknowledged, and the decisions only they can supersede. That section is read-only and uses the same rule check.

## Workflow gates and the reassignment trigger

Two workflow validators, added by a Jira admin to a transition in the workflow editor:

- **Handoff Guard** (`handoff-guard-validator`): lets the transition through only when the prepared handoff is Clear and the work item is held by its sender, its receiver or no one.
- **Handoff Guard: no decision contradicted** (`decision-guard-validator`): for transitions that are not a handoff. It needs no handoff record and refuses only when the work item breaks a decision that binds it.

Both read the work item as the app (a validator carries no user session) and refuse when they cannot check.

One trigger (`handoff-guard-reassigned`, on `avi:jira:updated:issue`): when the assignee changes from one person to another, it records a handoff from the old assignee to the new one, so the receiver's decisions are listed without anyone clicking Prepare. It reads nothing from Jira and writes only that record. A newly set or removed assignee, or a record that already names the new person, is left alone; a different receiver replaces the record, so acknowledgements never carry over to a new person.

## Scopes

Every scope in `manifest.yml` and why it is there. A test fails if this table and the manifest differ. The app has no `permissions.external`: it sends nothing outside Atlassian.

| Scope | Reason |
|---|---|
| `read:jira-work` | Read the work item and its comments as the current user. |
| `read:graph:issue:jira` | Teamwork Graph: start from the work item to find people connected to it. |
| `read:graph:user:atlassian` | Teamwork Graph: return people connected to the work item (advisory, never a rule input). |
| `storage:app` | Store decisions, handoff records and proposals in Forge storage. |

## Rovo MCP server

The app has one `rovo:mcp` module ("Handoff Guard") that exposes the same eight actions the Rovo agent uses: `check-handoff`, `list-binding-decisions`, `read-decision-source`, `propose-decisions`, `gather-handoff-context`, `draft-receipt`, `check-condition`, `draft-condition`. External access is off by default. A site admin turns it on per installation in Atlassian Administration (Apps, Sites, the site, Connected apps, this app, Tools). The endpoint is `https://mcp.atlassian.com/forge/8d2f4029-5c7f-49b4-a2b7-701a0ca1c1d2` (the app id in `manifest.yml`). Tools run with the calling user's permissions. Over MCP there is no work item context, so pass `issueKey` such as `OPS-1`. `propose-decisions` only saves proposals and `draft-condition` only saves drafts; a person confirms them in the panel or on the Decisions page. `check-condition` takes `projectKey`.

## I-PASS structure

Handoff Guard follows the structure of the I-PASS handoff protocol (illness severity, patient summary, action list, situation awareness and contingency, synthesis by receiver) over Jira work items. The rule check stays the only thing that decides; each part is plain code over it.

| I-PASS part | In Handoff Guard |
|---|---|
| Illness severity | The verdict with its I-PASS name beside it: Clear is Stable, Needs info is Watcher, Blocked is Unstable. It is a label for the verdict, not a second scale. |
| Patient summary | The handoff brief: the work item, the decisions that bind it and the findings. |
| Action list | One action per finding with its owner (sender, receiver or decision owner), read from the findings. No findings, no actions. |
| Situation awareness and contingency | An optional "if … then …" written by the sender and shown to the receiver. If it is not in that form the panel says so; that is advice, not a finding, unless a project administrator released one of the project rules ("Require a contingency", "Require the if-then form"), which make it a Needs info finding. |
| Synthesis by receiver | One read-back for the whole handoff. It must mention each binding decision by its title or by a date, label or component it sets. |

The read-back checks that each decision is addressed, not that it was understood.

Teach-back: a read-back that addresses a decision but contradicts it is refused too, by plain code. That covers a date later than a date limit, a required label or component said to be skipped, optional or not needed, and a forbidden one said to be added. The refusal gives the code's reason. One sentence beside it, telling the receiver what to write instead, is written by a model through Forge LLMs (Claude Haiku 4.5, run on Atlassian's platform). The panel labels that sentence as model-written, and says so when it is missing. It never makes, lifts or changes a refusal.

In hospitals, I-PASS was linked to fewer medical errors and preventable adverse events (Starmer et al., N Engl J Med 2014;371:1803-1812). Those are clinical results from a hospital study, given here as background for the protocol. They are not a result of this app, which does not measure errors, harm or reassignments.

## Honesty notes

- The samples used to measure the rules are synthetic.
- The labels on those samples are written by a model (Muse). A second set of labels was written by people: paid experts on Toloka, two per sample, one pilot, 2026-11-13.
- The measured figures are "agreement with Muse labels" and "agreement with human-decided labels", not accuracy. Every number below comes from `npm run measure`.
- The labelling instructions given to Muse (`scripts/label_samples.py`) restate the app's rules in prose, so the agreement figure mostly measures whether Muse applied that specification the same way the code does, not whether the rules are the right rules. Of the 48 samples, 38 were written by Muse itself, which also labeled them; the other 10 are adversarial cases written by Claude Sonnet.

## Measurement

48 synthetic handoffs (38 generated by Muse, 10 adversarial cases written by Claude Sonnet), all labeled by Muse.

| Check | Agreement with Muse labels |
|---|---|
| Handoff Guard rules with recorded decisions | 47 of 48 (97.9%) |
| The same rules without decisions | 34 of 48 (70.8%) |
| No check (every handoff passes) | 12 of 48 (25.0%) |

The one disagreement: a description that is only filler ("tbd see above"). Muse wants more information; the rules pass it, because filler is a choice the rules leave to people (see "Rule decisions" in `docs/PROGRESS.md`).

### Human labels

The same 48 handoffs were also labeled by people on Toloka: two independent experts per sample, each choosing a verdict and writing a short reason. A sample counts only when both gave the same answer. 40 of 48 did; the other 8 are left out and are not settled by the rules or by Muse.

| Check | Agreement with human-decided labels |
|---|---|
| Human: Handoff Guard rules with recorded decisions | 36 of 40 (90.0%) |
| Human: the same rules without decisions | 25 of 40 (62.5%) |
| Human: no check (every handoff passes) | 17 of 40 (42.5%) |
| Human: Muse labels | 35 of 40 (87.5%) |

The four rules-versus-people disagreements are all samples with no due date: the rules ask for more information, the people said clear. The instructions given to the experts said a due date must be valid, not that a missing one counts as missing, so this is at least partly a gap in those instructions, not proof the rules are wrong. The instructions also described a decision's reach as a project or a label or component, and left out a decision that names one work item; that was corrected in the repository while the pilot ran, and it is not recorded which wording the experts saw. Seven samples use such a decision; three of them are among the eight left out. Two experts per sample is a small panel; no figure here is an error rate of the app.

## Limits

The four that matter most; the full list follows.

- The read-back checks that each decision is addressed and catches a fixed list of contradictions; it does not prove the receiver understood.
- Reaching Clear needs a second person as receiver; one account shows a refused and an accepted read-back.
- Decisions, rules and the activity list are stored per project in Forge storage with a version check that narrows, but does not close, a race between two saves.
- The app is Jira-only, and the Rovo, MCP and Teamwork Graph paths name their source when they are unavailable.

All of them:

- "Leaving the project" covers only the open work items of that project that you can see, up to the page's limit, and it does not know whether a person has left: someone picks the name.
- The workflow validator reads the work item as the app, not as the person making the transition, so it can check an item that person may not see. It returns only findings. Project rules are re-read just before each change and the activity list is re-read just before each append; neither is atomic, so two changes within milliseconds can lose one.
- Decisions are stored under one storage key per project, and a save is refused when another save landed first. Forge storage has no atomic compare-and-set here, so a window of a few milliseconds remains, and a project with a very large number of decisions would still hit the size limit of its value.
- The workflow validator lets a transition through when the prepared handoff is Clear and the work item is held by its sender, its receiver or nobody. It refuses when a third person is the assignee. It does not require that the receiver is already the assignee; the panel shows that mismatch as advice.
- Confirming, adding and superseding a decision, and loading or removing sample decisions, need a project administrator (Jira's own "Administer projects" permission, asked as the person). If Jira cannot answer, the app treats the person as not an administrator. Once a handoff is prepared, only its sender, the assignee or a project administrator can prepare it again.
- A proposed decision is kept only if its quote is in the work item's text; that does not prove the constraint follows from the quote. Read both before confirming.
- A decision scoped to a label binds only the project it was confirmed in.
- An agent can be the receiver of a handoff, by assigning it in the Assignee field, but it cannot acknowledge, so that handoff stays Needs info until a person changes the receiver.
- The read-back checks that each decision is addressed, not that it was understood.
- Teach-back catches only a fixed list of patterns: late dates, negation or "optional" wording around a required label or component, and adding wording before a forbidden one. It can miss other contradictions, and can misread a nearby negation about something else (the receiver then rewrites the read-back). Loose dates ("early January") and indirect wording are among what it misses.
- The model sentence beside a teach-back refusal is sent the read-back and the code's reasons. Its wording varies between attempts.
- Superseding a decision from the Decisions page needs a project administrator. A decision with a recorded confirmer can be superseded only by that confirmer. "Confirm and supersede" in the panel retires the older decisions the new one makes redundant that you may supersede (you are a project administrator, and you confirmed them or they have no recorded confirmer); a decision someone else confirmed stays in force and the panel names it.
- Reassigning a work item to a different person starts a new handoff record: the earlier acknowledgements, read-back and contingency are not carried over.
- A handoff prepared before read-back existed keeps one acknowledgement per decision, and the panel says that no read-back was checked.
- A Jira filter decision is evaluated by Jira: as the viewer in the panel, the Rovo actions and the counts, and as the app in the workflow validator, so results can differ where permissions differ. The validator checks the stored work item, not fields changed on the transition screen. At most 5 filters per project are evaluated; the rest read as not checked. Replay on a date evaluates a filter as of now.
- Teach-back has no contradiction pattern for a filter or a commitment: the receiver addresses them by title, and code cannot compare prose with JQL.
- Rovo writes the filter and can write a wrong one. The counts and keys come from Jira, are shown before anything is stored, and a person confirms; the Rovo counts cover only the first 100 open work items and say so.

## Privacy and security

See `docs/PRIVACY.md` and `docs/SECURITY.md`.

## For developers

- TypeScript on Forge (UI Kit), tests with vitest. `src/rules/` is the rule core: pure, no Forge imports, no network, no clock (time is passed in); `tests/boundaries.test.ts` keeps it so.
- `npm ci`, then `npm run typecheck`, `npm test` and `npm run measure`. On Windows, `powershell -File scripts/check.ps1` runs all of them plus `forge lint` and the script tests; CI (`.github/workflows/check.yml`) runs the same without `forge lint`.
- Every storage write goes through `src/store.ts`; the keys are listed in `docs/PRIVACY.md`. The docs are indexed in `docs/README.md`, the data in `data/README.md`.

## License

MIT, see `LICENSE`.

## Support

Report a problem or ask a question in this repository's [GitHub issues](https://github.com/hoachauphuoc/handoff-guard/issues). In the panel, **Show help** shows the guided steps and one hint beside each finding; the hints are panel wording only and never change a finding or the verdict.
