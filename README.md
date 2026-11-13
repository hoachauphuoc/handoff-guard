# Handoff Guard

A Forge app for Jira. When a work item is handed to someone else, rules check what is missing and which recorded decisions bind it. The verdict (Clear, Needs info, Blocked) always comes from plain code (`checkHandoff()`); Rovo only explains it and proposes decisions that a person must confirm.

## Install (for judges)

1. Install the app on a Jira site from the installation link in the Devpost submission. The app is Jira-only: it declares no Confluence scope and no multi-app compatibility, so it installs on any single Jira site. Developers working on the app install their own build with `forge install -e development --product jira`.
2. Open a work item, click the apps icon under the summary (tooltip "View app actions") and choose **Handoff Guard**. The panel shows a getting-started checklist. A step-by-step path of about 10 minutes, with the exact read-backs to type, is in `docs/DEVPOST.md` ("Testing instructions"). One account is enough to see a refusal and an accepted read-back; reaching Clear needs a second user as receiver.
3. Teamwork Graph needs no setup from you. If it returns nothing, or was not asked, the app says so, and no rule depends on it.

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
- The labels on those samples are written by a model (Muse), not by people.
- The measured figure is "agreement with Muse labels", not accuracy. Every number below comes from `npm run measure` (2026-11-12).
- The labelling instructions given to Muse (`scripts/label_samples.py`) restate the app's rules in prose, so the agreement figure mostly measures whether Muse applied that specification the same way the code does, not whether the rules are the right rules. Of the 48 samples, 38 were written by Muse itself, which also labeled them; the other 10 are adversarial cases written by Claude Sonnet.

## Measurement

48 synthetic handoffs (38 generated by Muse, 10 adversarial cases written by Claude Sonnet), all labeled by Muse.

| Check | Agreement with Muse labels |
|---|---|
| Handoff Guard rules with recorded decisions | 47 of 48 (97.9%) |
| The same rules without decisions | 34 of 48 (70.8%) |
| No check (every handoff passes) | 12 of 48 (25.0%) |

The one disagreement: a description that is only filler ("tbd see above"). Muse wants more information; the rules pass it, because filler is a choice the rules leave to people (see "Rule decisions" in `docs/PROGRESS.md`).

## Limits

- All decisions are stored under one storage key, so two people confirming or superseding at the same moment can lose one of the two changes.
- An agent can be the receiver of a handoff, by assigning it in the Assignee field, but it cannot acknowledge, so that handoff stays Needs info until a person changes the receiver.
- The read-back checks that each decision is addressed, not that it was understood.
- Teach-back catches only a fixed list of patterns: late dates, negation or "optional" wording around a required label or component, and adding wording before a forbidden one. It can miss other contradictions, and can misread a nearby negation about something else (the receiver then rewrites the read-back). A full date anywhere in the read-back is read as the delivery date; a month alone ("Jan 2027") or a numeric date ("01/10/2027") is read only right after by, in, on, until, before, after or to. Loose dates ("early January") and indirect wording are among what it misses.
- The model sentence beside a teach-back refusal is sent the read-back and the code's reasons. Its wording varies between attempts.
- Only the person who confirmed a decision can supersede it from the Decisions page (decisions with no recorded confirmer, such as the samples, can be superseded by anyone signed in). "Confirm and supersede" in the panel retires the older decisions the new one makes redundant that you may supersede (the ones you confirmed, or with no recorded confirmer); a decision someone else confirmed stays in force and the panel names it.
- Reassigning a work item to a different person starts a new handoff record: the earlier acknowledgements, read-back and contingency are not carried over.
- A handoff prepared before read-back existed keeps one acknowledgement per decision, and the panel says that no read-back was checked.

## Privacy and security

See `docs/PRIVACY.md` and `docs/SECURITY.md`.
