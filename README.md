# Handoff Guard

A Forge app for Jira. When a work item is handed to someone else, the receiver restates each recorded decision that binds it, and plain code refuses a restatement that contradicts one in ways it can detect, for example a date after a recorded limit or a required label described as skipped. It does not catch every contradiction or prove understanding. Rules also check what is missing from the work item. The verdict (Clear, Needs info, Blocked) always comes from plain code (`checkHandoff()`); Rovo only explains it and proposes decisions that a person must confirm.

## Try it in 3 minutes (one account)

Use an account that is a project administrator of the Jira project. Load sample decisions, confirming, adding and superseding a decision need Jira's "Administer projects" permission.

1. Install from the installation link in the Devpost submission and open any work item. Click the apps icon under the summary ("View app actions"), then **Handoff Guard**. You should see a checklist headed "Handing over this work".
2. Click **Load sample decisions (demo)**. You should see "4 stored decisions for this project". Nothing is written to Jira.
3. Under "Practice read-back", type `Work ships by the end of 2026: I will ship on 15 January 2027. Stop using the legacy billing component: understood.` and click **Try a read-back (practice, nothing is saved)**. You should see "This read-back would be refused:", the code's reason about the 2026-12-31 limit, and one sentence labelled as written by a model.
4. Change the date to `15 December 2026` and click again. You should see "This read-back would be accepted."

That refusal is the point of the app: the receiver restates each decision, and plain code refuses a restatement that contradicts one in ways it can detect. It does not catch every contradiction or prove understanding. The practice check stores nothing and gives no verdict. A real handoff, with a second user as receiver, reaches Clear through the same check; the 10-minute path is in `docs/DEVPOST.md`.

## Install (for judges)

1. Install the app on a Jira site from the installation link in the Devpost submission. The app is Jira-only: it declares no Confluence scope and no multi-app compatibility, so it installs on any single Jira site. Developers working on the app install their own build with `forge install -e development --product jira`.
2. Open a work item, click the apps icon under the summary (tooltip "View app actions") and choose **Handoff Guard**. The panel shows a short checklist with three paths to choose from: "New to this project", "Handing over this work" (the default) and "Leaving the project". A step-by-step path of about 10 minutes, with the exact read-backs to type, is in `docs/DEVPOST.md` ("Testing instructions"). One account is enough to see a refusal and an accepted read-back; reaching Clear needs a second user as receiver.
3. Teamwork Graph needs no setup from you. If it returns nothing, was not asked, or could not be read (one retry, then the app says so), the app says which, and no rule depends on it.

## Joining, handing over, leaving

The panel's checklist has one path for each moment. "New to this project" points a newcomer at the decisions that bind the work item, the handoff brief and the project's Decisions page. "Handing over this work" is the handoff itself. "Leaving the project" leads to a section of the same name on the Decisions page: pick a person and it lists their open work items with the state of each handoff, the handoffs they have not acknowledged, and the decisions only they can supersede. That section is read-only and uses the same rule check.

## Scopes

Every scope in `manifest.yml` and why it is there. A test fails if this table and the manifest differ. The app has no `permissions.external`: it sends nothing outside Atlassian.

| Scope | Reason |
|---|---|
| `read:jira-work` | Read the work item and its comments as the current user. |
| `read:graph:issue:jira` | Teamwork Graph: start from the work item to find people connected to it. |
| `read:graph:user:atlassian` | Teamwork Graph: return people connected to the work item (advisory, never a rule input). |
| `storage:app` | Store decisions, handoff records and proposals in Forge storage. |

## Rovo MCP server

The app has one `rovo:mcp` module ("Handoff Guard") that exposes the same five actions the Rovo agent uses: `check-handoff`, `list-binding-decisions`, `read-decision-source`, `propose-decisions`, `gather-handoff-context`. External access is off by default. A site admin turns it on per installation in Atlassian Administration (Apps, Sites, the site, Connected apps, this app, Tools). The endpoint is `https://mcp.atlassian.com/forge/<app UUID>`. Tools run with the calling user's permissions. Over MCP there is no work item context, so pass `issueKey` such as `OPS-1`. `propose-decisions` only saves proposals; a person confirms them in the panel.

## I-PASS structure

Handoff Guard follows the structure of the I-PASS handoff protocol (illness severity, patient summary, action list, situation awareness and contingency, synthesis by receiver) over Jira work items. The rule check stays the only thing that decides; each part is plain code over it.

| I-PASS part | In Handoff Guard |
|---|---|
| Illness severity | The verdict with its I-PASS name beside it: Clear is Stable, Needs info is Watcher, Blocked is Unstable. It is a label for the verdict, not a second scale. |
| Patient summary | The handoff brief: the work item, the decisions that bind it and the findings. |
| Action list | One action per finding with its owner (sender, receiver or decision owner), read from the findings. No findings, no actions. |
| Situation awareness and contingency | An optional "if … then …" written by the sender and shown to the receiver. If it is not in that form the panel says so; that is advice, not a finding. |
| Synthesis by receiver | One read-back for the whole handoff. It must mention each binding decision by its title or by a date, label or component it sets. |

The read-back checks that each decision is addressed, not that it was understood.

Teach-back: a read-back that addresses a decision but contradicts it is refused too, by plain code. That covers a date later than a date limit, a required label or component said to be skipped, optional or not needed, and a forbidden one said to be added. The refusal gives the code's reason. One sentence beside it, telling the receiver what to write instead, is written by a model through Forge LLMs (Claude Haiku 4.5, run on Atlassian's platform). The panel labels that sentence as model-written, and says so when it is missing. It never makes, lifts or changes a refusal.

In hospitals, I-PASS was linked to fewer medical errors and preventable adverse events (Starmer et al., N Engl J Med 2014;371:1803-1812: 23% and 30% fewer). Those are clinical results from a hospital study. They are not a result of this app, which does not measure errors, harm or reassignments.

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

The same 48 handoffs were also labeled by people on Toloka: two independent experts per sample, each choosing a verdict and writing a short reason. A sample counts only when both gave the same answer. 40 of 48 did; the other 8 are left out and are not settled by the rules or by Muse. The pilot cost USD 49.81, above the USD 45 limit set for it (Toloka's forecast was USD 32.42; the extra came from answers sent back for a replacement).

| Check | Agreement with human-decided labels |
|---|---|
| Human: Handoff Guard rules with recorded decisions | 36 of 40 (90.0%) |
| Human: the same rules without decisions | 25 of 40 (62.5%) |
| Human: no check (every handoff passes) | 17 of 40 (42.5%) |
| Human: Muse labels | 35 of 40 (87.5%) |

The four rules-versus-people disagreements are all samples with no due date: the rules ask for more information, the people said clear. The instructions given to the experts said a due date must be valid, not that a missing one counts as missing, so this is at least partly a gap in those instructions, not proof the rules are wrong. The instructions also described a decision's reach as a project or a label or component, and left out a decision that names one work item; that was corrected in the repository while the pilot ran, and it is not recorded which wording the experts saw. Seven samples use such a decision; three of them are among the eight left out. Two experts per sample is a small panel; no figure here is an error rate of the app.

## Limits

- "Leaving the project" covers only the open work items of that project that you can see, up to the page's limit, and it does not know whether a person has left: someone picks the name.
- Decisions are stored under one storage key per project, and a save is refused when another save landed first. Forge storage has no atomic compare-and-set here, so a window of a few milliseconds remains, and a project with a very large number of decisions would still hit the size limit of its value.
- The workflow validator checks that the prepared handoff is Clear for the handoff's recorded receiver. It does not compare that receiver with the current assignee; the panel shows a mismatch as advice.
- Confirming, adding and superseding a decision, and loading or removing sample decisions, need a project administrator (Jira's own "Administer projects" permission, asked as the person). If Jira cannot answer, the app treats the person as not an administrator. Once a handoff is prepared, only its sender, the assignee or a project administrator can prepare it again.
- A proposed decision is kept only if its quote is in the work item's text; that does not prove the constraint follows from the quote. Read both before confirming.
- A decision scoped to a label binds only the project it was confirmed in.
- An agent can be the receiver of a handoff, by assigning it in the Assignee field, but it cannot acknowledge, so that handoff stays Needs info until a person changes the receiver.
- The read-back checks that each decision is addressed, not that it was understood.
- Teach-back catches only a fixed list of patterns: late dates, negation or "optional" wording around a required label or component, and adding wording before a forbidden one. It can miss other contradictions, and can misread a nearby negation about something else (the receiver then rewrites the read-back). A full date anywhere in the read-back is read as the delivery date; a month alone ("Jan 2027") or a numeric date ("01/10/2027") is read only right after by, in, on, until, before, after or to. Loose dates ("early January") and indirect wording are among what it misses.
- The model sentence beside a teach-back refusal is sent the read-back and the code's reasons. Its wording varies between attempts.
- Superseding a decision from the Decisions page needs a project administrator. A decision with a recorded confirmer can be superseded only by that confirmer. "Confirm and supersede" in the panel retires the older decisions the new one makes redundant that you may supersede (you are a project administrator, and you confirmed them or they have no recorded confirmer); a decision someone else confirmed stays in force and the panel names it.
- Reassigning a work item to a different person starts a new handoff record: the earlier acknowledgements, read-back and contingency are not carried over.
- A handoff prepared before read-back existed keeps one acknowledgement per decision, and the panel says that no read-back was checked.

## Privacy and security

See `docs/PRIVACY.md` and `docs/SECURITY.md`.

## Support

Report a problem or ask a question in this repository's [GitHub issues](https://github.com/hoachauphuoc/handoff-guard/issues). In the panel, **Show help** shows the guided steps and one hint beside each finding; the hints are panel wording only and never change a finding or the verdict.
