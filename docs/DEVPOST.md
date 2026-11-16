# Devpost submission draft

Owner submits. Category: Apps for Software Teams. Bonus prizes: Best Agents (rovo:agent and eight actions), Best app with MCP (rovo:mcp), Best apps with Teamwork Graph integration.

## Tagline

The read-back gate for Jira handoffs: the work changes hands only when the receiver's own read-back agrees with the decisions the team recorded.

A task is handed over on Friday. The team decided it ships by the end of the year, but nobody told the receiver. With Handoff Guard the receiver restates each recorded decision before taking the work, and plain code refuses a restatement that contradicts one in ways it can detect, for example a date after a recorded limit or a required label described as skipped. It does not catch every contradiction or prove understanding.

## In short

- **The read-back gate: the receiver reads back, and code can say no.** Before taking the work, the receiver restates each recorded decision that binds it. "I will ship on 15 January 2027" against a decision that says end of 2026 is refused, with the reason, by plain code.
- **A verdict from rules.** Clear, Needs info or Blocked comes from a rule check on the work item, the recorded decisions and the acknowledgements. A model only writes sentences that are labelled as model-written.
- **A gate in the workflow.** Where a Jira admin adds the validator, the transition goes through only when the handoff is Clear.
- **Decisions that keep each other honest, and a record of what went wrong.** A new decision that contradicts one in force is refused unless it supersedes the older one; if the work item changes after the receiver agreed, the acknowledgement goes stale; and handoffs that bounced back are counted with what they lacked, so a project administrator can turn a lack into a rule.

With one account, three minutes show a read-back refused and then accepted; a Clear verdict needs a second account as receiver (steps 4-6 of "Testing instructions" below). Everything else the app does is under "What it does".

## Who it is for

Software teams whose Jira work items change owner while the work is still open: release work passed between engineers, on-call rotation, cover for someone on leave. The buyer we have in mind is an engineering manager or release owner.

- **What it costs a team to start:** a project administrator records the decisions (by hand on the Decisions page, or by confirming what Rovo proposes from text the team already wrote), and a Jira admin adds the validator to the handoff transition. Senders and receivers then work in the panel. Nothing here has been timed with a real team yet.
- **Who would pay (a hypothesis):** see "What's next". No customer has been asked about price, and no one outside this project has used the app yet: the outside user test (`docs/USER-TEST.md`) has not been run.

## The problem

When a work item changes hands, the decisions that bind it (a deadline, a required review, a component nobody may touch) stay in someone's head, a page or a comment. The next person finds out late.

- Reassignment is common and it costs time: in Mozilla and Eclipse, 37-44% of bug reports were reassigned, and reassignment increased the time to fix (Jeong, Kim, Zimmermann, ESEC/FSE 2009). Not every reassignment is bad; some are how work finds the right owner (Guo et al., CSCW 2011).
- Decisions do not travel well: Atlassian's State of Teams 2025, as cited on Atlassian's blog, found that only 20% of knowledge workers are confident in their team's process for sharing decisions that affect each other's work.
- Jira users say the same in their own words: on the Atlassian Community a programme lead asks how to track key decisions because they end up scattered across comments, work items and pages ([thread](https://community.atlassian.com/forums/discussion/3195026/best-practice-for-tracking-key-decisions-and-major-changes-in-jira-cloud)), and Atlassian's own knowledge base explains how to tell the previous assignee when a work item is reassigned, because Jira does not by default ([article](https://support.atlassian.com/jira/kb/send-notification-to-previous-assignee-when-assignee-changes-on-a-jira-issue)).
- We borrow the receiver's read-back from I-PASS, a hospital handoff protocol linked to fewer medical errors (Starmer et al., N Engl J Med 2014); that hospital result says nothing about Jira, and we have not measured errors here.

## What is different

| | Handoff briefs and handover forms | Decision logs | Checklists with a workflow check | Handoff Guard |
|---|---|---|---|---|
| Writes down what the next person needs | Yes | No | Partly | Yes |
| Keeps a register of decisions | No | Yes | No | Yes |
| Applies recorded decisions to the work item being handed over | No | No | No | Yes, in plain code |
| Refuses a receiver's read-back that contradicts a decision | No | No | No | Yes, in plain code |
| Makes an acknowledgement stale when the item changes afterwards | No | No | No | Yes |
| Blocks the workflow transition until the handoff is Clear | No | Some | Yes | Yes, on transitions where an admin adds the validator; it also refuses when a third person, neither sender nor receiver, is the assignee |

The comparison is from the public listings reviewed, by category. None of those described a receiver read-back refused for contradicting a recorded decision. In Handoff Guard a model never decides: the verdict and every refusal come from rules, and model-written text is labelled.

## What it does

Core:

- **Handoff check.** The panel on a work item records a handoff to a named receiver and runs plain rules: the item must have a description and a due date, must not contradict any recorded decision, and the receiver must acknowledge every decision that binds it. The verdict is Clear, Needs info or Blocked.
- **Read-back with teach-back.** The receiver acknowledges with one read-back that must address each binding decision. A read-back that addresses a decision but contradicts it (a date past the limit, a required label said to be skipped, a forbidden one said to be added) is refused by plain code. One sentence beside the refusal, telling the receiver what to write instead, is written by a model through Forge LLMs and labelled as model-written; it never makes or lifts a refusal.
- **Workflow validator.** A transition with the validator only goes through when the handoff is Clear and the work item is held by its sender, its receiver or nobody. A third person as assignee is refused.

Also (one line each; the README has the detail):

- **Around the handoff.** Joining, handing over and leaving checklists; suggested fixes (advice, the app never edits the item); the I-PASS structure with an owner per finding and an optional "if ... then ..." contingency; handoff drift, which makes an acknowledgement stale when the item changes after it.
- **Decisions for any business rule.** What your team decides is data; the code knows only the shape of a decision. Besides dates, labels and components, a decision can be a Jira filter (JQL) that Jira evaluates for the one work item, a commitment the receiver confirms by name, or a link to where it was decided, shown and never read.
- **Rovo, MCP and Teamwork Graph.** The Rovo agent explains the verdict in the rule check's own words and proposes decisions found in the item with a word-for-word quote, binding nothing until a person confirms; for an administrator it turns a rule in plain words into JQL, has code count what it would block, and stores a draft that a person confirms on the Decisions page; the handoff brief adds connected people from Teamwork Graph; the same eight actions are exposed through `rovo:mcp`.
- **Decisions over time.** Adding a decision by hand with a preview of the items it would contradict; activity, counts, export and delete; typed answers a receiver can give instead of free text (Rovo may draft them, a person signs); refusal of a decision that says the opposite of one in force; replay of verdicts on an earlier date; superseding decisions.
- **Bounce autopsy and governance.** The Decisions page reads Jira history for handoffs that were Clear and then came back, counts what they lacked beside those that did not bounce, and lets a project administrator release a rule from a fixed catalogue of three after seeing how many handoffs it would turn to Needs info. Code only; a count, not proof of a cause.
- **Jira-only.** No Confluence scope; installs on any Jira site.

## How we built it

Forge (UI Kit, resolvers, Forge storage), a pure TypeScript rule core with no Forge imports, `rovo:agent` with eight actions, a `rovo:skill` ("handoff-check") that the agent uses to check a work item before it starts work, calling only `check-handoff` and `gather-handoff-context`, `rovo:mcp`, `jira:workflowValidator`, and two saved Teamwork Graph Cypher queries called with `asUser()`. Unit tests cover every rule and principle and run with one command. Only decisions, handoff records and proposals are stored; no chat is stored.

## Measurement

48 synthetic handoffs, labeled by a model (Muse). Agreement with Muse labels: 47 of 48 with recorded decisions, 34 of 48 with the rules alone, 12 of 48 with no check. With human-decided labels: 36 of 40 where two human experts agreed, with recorded decisions. Both figures are agreement with labels, not accuracy on real handoffs. The samples and labels are synthetic and model-written from our own specification, Muse wrote 38 of the 48 samples and labelled all of them (the other 10 are adversarial cases written by Claude Sonnet), so the figures show that the code matches the specification, not that the specification is right.

## Challenges

- Keeping the model out of the verdict: Rovo may only quote and explain, so the rule result is passed through untouched and the prompts forbid predicting it.
- Evidence that cannot be invented: a proposed decision is kept only when its quote is found word for word in the work item, read again as the caller.
- Teamwork Graph returns empty rows rather than errors when a scope or permission is missing, so the UI says "returned nothing" and never treats it as a fact.

## What's next

A pilot with one release team (the plan, with its baseline, sample size and stop conditions, is `docs/PILOT.md`). None of this is measured yet.

- **The one number the pilot is judged on:** handoffs bounced back to the sender or reopened within 7 days of the receiver's read-back, against the same team's four weeks before. Time to the first read-back is watched as the cost, not as the result.
- **Who would pay (a hypothesis, not a plan):** an engineering manager or release owner. A single project stays free; decisions shared across projects, the validator across many workflows, and export of the activity list are what a paid tier would hold. The untested price: $0.50 per licensed user per month for the first 100 seats, progressive tiers above, floor $10 per month, which is about 6% of Jira Standard's $8.60 per seat. Eligible Forge apps are announced to pay 0% revenue share up to $1M lifetime Forge revenue; the sources, the competitors found, and what the research does not show are in `docs/MARKET.md`. No customer has been asked about price.

Then decide from the pilot whether to watch more sources for decisions or share decisions across projects.

## Testing instructions (for judges)

Use an account that is a project administrator of the Jira project. Load sample decisions, confirming, adding and superseding a decision need Jira's "Administer projects" permission. About 10 minutes on a Jira site where you are a site admin. With one account you see a refused read-back and an accepted one. Reaching Clear needs a second user as receiver: if you pick yourself, the handoff stays Blocked with "Sender and receiver are the same person", which is the rule working.

**Three minutes, one account.** After steps 1 to 3 below, type the read-back of step 5 into the box under "Practice read-back" (it shows beside your next step; on a work item that already has a handoff, click **Show everything** first) and click **Try a read-back (practice, nothing is saved)**: it is refused, with the code's reason. Type the read-back of step 6: "Would be accepted", with no contradiction found in the dates, labels and components the code reads. The practice check stores nothing and gives no verdict; steps 4 to 7 are the real handoff.

The panel can take several seconds to load the first time.

1. Open the installation link below, choose your site, select Jira and click Install. The app asks for four permissions and nothing for Confluence.
2. Open a work item. Under the summary click the apps icon (its tooltip is "View app actions"), then **Handoff Guard**; the panel opens below the description. If Jira asks, click **Allow access** and reload. The panel opens on one card, "Your next step". If you get lost, **Apps** in Jira's top bar has **Handoff Guard: start here**, with a button for each step.
3. Click **Load sample decisions (demo)**. This stores demo decisions for that project in the app; nothing is written to Jira. The panel then says "4 stored decisions for this project"; two bind every item in the project: "Work ships by the end of 2026" and "Stop using the legacy billing component".
4. Give the work item a description and a due date in 2026. Pick a receiver (a second user, or yourself) and click **Prepare handoff**. The findings say the receiver has not acknowledged the two decisions.
5. As the receiver, open the same work item and the panel. In the read-back box write: `Work ships by the end of 2026: I will ship on 15 January 2027. Stop using the legacy billing component: understood.` Click **Acknowledge all with this read-back**. It is refused, with the code's reason and one sentence labelled as written by a model.
6. Replace the read-back with: `Work ships by the end of 2026: I will ship by 15 December 2026. Stop using the legacy billing component: understood.` It is accepted and both decisions read "Acknowledged." With a second user as receiver the verdict becomes Clear.
7. Drift: change the due date of the work item and reload the panel. The acknowledgement is stale and the receiver is asked to read back again.
8. Optional, Jira admin: in the workflow editor, add the **Handoff Guard** validator to a transition (edit the transition, then Validators). A work item whose handoff is not Clear is refused on that transition, and so is one assigned to a third person who is neither the sender nor the receiver. The refusal says "Prepare the handoff in the Handoff Guard panel first." both when the status is changed from the work item view and when a card is dragged on a board (seen on the demo site, 2026-11-14).

Steps 9 to 11 need Rovo enabled on the site. Without Rovo the panel says so.

9. Optional, Rovo: click **Explain with Rovo** in the panel, or open the Handoff Guard agent in Rovo Chat and ask "Is this work item ready to hand off?".
10. Optional, MCP: a site admin turns the tools on in Atlassian Administration (Apps, Sites, your site, Connected apps, Handoff Guard, Tools). An MCP client then connects to `https://mcp.atlassian.com/forge/8d2f4029-5c7f-49b4-a2b7-701a0ca1c1d2` (the app id from `manifest.yml`) and calls `check-handoff` with `issueKey`.

11. Optional, Rovo for a project administrator: ask the agent "Would the filter prioritee = Highest work as a rule in <your project key>?". It gives Jira's error word for word and offers `priority = Highest`; ask it to check that and draft it. The draft appears on the project's Decisions page under "Drafted with Rovo (not in force)" and binds nothing until you click **Confirm**.

Teamwork Graph: **Gather handoff context** in the Rovo agent returns people connected to the work item. On a site with little activity it may say that Teamwork Graph returned nothing; the app says so and uses it for no rule.

## What was seen working, and what was not

Seen on a live Jira Cloud site (development and production builds of this app): the refused read-back, the typed receipt refusing a date after the limit, acknowledgement by a second account, a stale acknowledgement after the due date changed, a Clear verdict, the validator refusing on a transition and on a board drag and letting a Clear handoff through on production (2026-11-15), and the Teamwork Graph "people connected" query returning one row (a person the work item was shared with). Not seen: a real bounced handoff; the Rovo agent on a site other than ours; a call from an external MCP client (the tools are declared and their code is the same as the agent's actions, but we have not logged a live MCP call); the validator with a Jira filter decision on a real transition (covered by unit tests with Jira mocked). A site without Rovo or Teamwork Graph access gets a panel that says so, and nothing in the main path depends on them.

Not covered, by design or for now:
- Two saves of the decisions within milliseconds can still lose one: a version check narrows the race, but Forge storage here has no atomic compare-and-set. The three project rule switches have no version check at all.
- The workflow validator reads the work item and the decisions as the app, because a validator has no user session, so it can check an item the person moving it cannot open.
- Delete and export cover the whole project's decisions, drafts, rules and activity, but per-work-item records (handoffs, proposals, receipt drafts) only on the first 100 open work items the administrator can see; records on closed items stay until the app is uninstalled.

## Bonus prizes

- **Best Agents.** `rovo:agent` "Handoff Guard" with eight `action` modules, including `check-condition` (counts which open work items a Jira filter would match, before anything is stored) and `draft-condition` (stores a rule as a draft that binds nothing until an administrator confirms it on the Decisions page), and a `rovo:skill` ("handoff-check") that the agent lists and that may call only `check-handoff` and `gather-handoff-context` (seen in chat on development, 2026-11-16: "Start work on TD-1." began with the rule check's quote and declined to start). The agent explains and proposes; the rule check decides.
- **Best app with MCP.** One `rovo:mcp` module exposes the same eight actions as tools to external MCP clients, run with the calling user's permissions. A live call from an MCP client is not logged yet (see "Not seen").
- **Best apps with Teamwork Graph integration.** The app consumes the Teamwork Graph API: two saved Cypher queries, called as the current user, return people the work item was shared with or who are mentioned on it.

## Links

- Video: (owner adds)
- Repository: https://github.com/hoachauphuoc/handoff-guard
- Installation link: (owner adds)

