# Devpost submission draft

Owner submits. Category: Apps for Software Teams. Bonus prizes: Best Agents (rovo:agent and five actions), Best app with MCP (rovo:mcp), Best apps with Teamwork Graph integration.

## Tagline

A Jira handoff goes through only when the receiver's own read-back agrees with the decisions the team recorded.

A task is handed over on Friday. The team decided it ships by the end of the year, but nobody told the receiver. With Handoff Guard the receiver restates each recorded decision before taking the work, and plain code refuses a restatement that contradicts one in ways it can detect, for example a date after a recorded limit or a required label described as skipped. It does not catch every contradiction or prove understanding.

## Who it is for

Software teams whose Jira work items change owner while the work is still open: release work passed between engineers, on-call rotation, cover for someone on leave.

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

Also:

**Around the handoff**

- **Joining and leaving.** The panel's checklist has three paths: new to the project, handing over, leaving. On the Decisions page, "Leaving the project" lists what one person still holds: their open work items with the state of each handoff, handoffs they have not acknowledged, and decisions only they can supersede. Read-only, from the same rule check.
- **Suggested fixes.** The smallest edits that would stop the item contradicting its decisions (a due date, a label to add, a component to remove). Advice only; the app never edits the work item.
- **I-PASS structure.** The panel follows the I-PASS handoff protocol over the rule check: a severity label beside the verdict, a patient-summary brief, an action list with an owner per finding, an optional "if ... then ..." contingency from the sender, and the receiver's read-back. The rule check stays the only thing that decides.
- **Handoff drift.** If the due date, a label or a component that a decision reads changes after the receiver acknowledged it, the acknowledgement goes stale and the panel shows what changed.
- **Jira-only.** The app declares no Confluence scope and installs on any Jira site.

**Rovo, MCP and Teamwork Graph**

- **Rovo agent.** Explains the verdict, quoting the rule check's sentence exactly. It finds decisions written in the description and comments and proposes them with a word-for-word quote as evidence. A proposal binds nothing until a person confirms it in the panel. A repeat of a confirmed decision is rejected.
- **Handoff brief.** Pulls what the receiver needs, including people connected to the item from Teamwork Graph (shared with, mentioned). Advisory; no rule reads it.
- **Rovo MCP server.** The same five actions are exposed through the `rovo:mcp` module for external agents.

**Decisions over time**

- **Adding a decision by hand.** On the Decisions page a project administrator writes a decision (title, where it applies, one constraint). "Check this decision" shows how many open work items would contradict it before it is saved. No Rovo is needed.
- **Activity, counts, export and delete.** The Decisions page lists who changed decisions and handoffs (the action, the person, the time and a key; no typed text) and counts handoffs prepared and read-backs accepted and refused per month. A project administrator can export everything the app holds for the project as JSON, and delete it after typing the project key.
- **Replay on a date.** The Decisions page shows which prepared handoffs would have had a different verdict on an earlier date, using the decisions and acknowledgements as they stood then.
- **Superseding decisions.** A decision that makes older ones redundant, or moves a deadline, can be confirmed with the older ones retired (only those the confirming person may supersede); the person who confirmed a decision can also retire it from the Decisions page. A superseded decision binds nothing.

## How we built it

Forge (UI Kit, resolvers, Forge storage), a pure TypeScript rule core with no Forge imports, `rovo:agent` with five actions, a `rovo:skill` ("Handoff check") that runs the rule check for other agents, `rovo:mcp`, `jira:workflowValidator`, and two saved Teamwork Graph Cypher queries called with `asUser()`. Unit tests cover every rule and principle and run with one command. Only decisions, handoff records and proposals are stored; no chat is stored.

## Measurement

48 synthetic handoffs, labeled by a model (Muse). Agreement with Muse labels: 47 of 48 with recorded decisions, 34 of 48 with the rules alone, 12 of 48 with no check. With human-decided labels: 36 of 40 where two human experts agreed, with recorded decisions. Both figures are agreement with labels, not accuracy on real handoffs. The samples and labels are synthetic and model-written from our own specification, so the figures show that the code matches the specification, not that the specification is right.

## Challenges

- Keeping the model out of the verdict: Rovo may only quote and explain, so the rule result is passed through untouched and the prompts forbid predicting it.
- Evidence that cannot be invented: a proposed decision is kept only when its quote is found word for word in the work item, read again as the caller.
- Teamwork Graph returns empty rows rather than errors when a scope or permission is missing, so the UI says "returned nothing" and never treats it as a fact.

## What's next

Pilot with one team and measure handoffs that are reopened or bounced back, which this version does not measure. Then decide from that whether to watch more sources for decisions or share decisions across projects.

## Testing instructions (for judges)

Use an account that is a project administrator of the Jira project. Load sample decisions, confirming, adding and superseding a decision need Jira's "Administer projects" permission. About 10 minutes on a Jira site where you are a site admin. With one account you see a refused read-back and an accepted one. Reaching Clear needs a second user as receiver: if you pick yourself, the handoff stays Blocked with "Sender and receiver are the same person", which is the rule working.

**Three minutes, one account.** After steps 1 to 3 below, type the read-back of step 5 into the box under "Practice read-back" and click **Try a read-back (practice, nothing is saved)**: it is refused, with the code's reason. Type the read-back of step 6: it "would be accepted". The practice check stores nothing and gives no verdict; steps 4 to 7 are the real handoff.

The panel can take several seconds to load the first time.

1. Open the installation link below, choose your site, select Jira and click Install. The app asks for four permissions and nothing for Confluence.
2. Open a work item. Under the summary click the apps icon (its tooltip is "View app actions"), then **Handoff Guard**; the panel opens below the description. If Jira asks, click **Allow access** and reload. A getting-started checklist in the panel shows the next step at any time.
3. Click **Load sample decisions (demo)**. This stores demo decisions for that project in the app; nothing is written to Jira. The panel then says "4 stored decisions for this project"; two bind every item in the project: "Work ships by the end of 2026" and "Stop using the legacy billing component".
4. Give the work item a description and a due date in 2026. Pick a receiver (a second user, or yourself) and click **Prepare handoff**. The findings say the receiver has not acknowledged the two decisions.
5. As the receiver, open the same work item and the panel. In the read-back box write: `Work ships by the end of 2026: I will ship on 15 January 2027. Stop using the legacy billing component: understood.` Click **Acknowledge all with this read-back**. It is refused, with the code's reason and one sentence labelled as written by a model.
6. Replace the read-back with: `Work ships by the end of 2026: I will ship by 15 December 2026. Stop using the legacy billing component: understood.` It is accepted and both decisions read "Acknowledged." With a second user as receiver the verdict becomes Clear.
7. Drift: change the due date of the work item and reload the panel. The acknowledgement is stale and the receiver is asked to read back again.
8. Optional, Jira admin: in the workflow editor, add the **Handoff Guard** validator to a transition (edit the transition, then Validators). A work item whose handoff is not Clear is refused on that transition, and so is one assigned to a third person who is neither the sender nor the receiver. The refusal says "Prepare the handoff in the Handoff Guard panel first." both when the status is changed from the work item view and when a card is dragged on a board (seen on the demo site, 2026-11-14).

Steps 9 and 10 need Rovo enabled on the site. Without Rovo the panel says so.

9. Optional, Rovo: click **Explain with Rovo** in the panel, or open the Handoff Guard agent in Rovo Chat and ask "Is this work item ready to hand off?".
10. Optional, MCP: a site admin turns the tools on in Atlassian Administration (Apps, Sites, your site, Connected apps, Handoff Guard, Tools). An MCP client then connects to `https://mcp.atlassian.com/forge/<app UUID>` and calls `check-handoff` with `issueKey`.

Teamwork Graph: **Gather handoff context** in the Rovo agent returns people connected to the work item. On a site with little activity it may say that Teamwork Graph returned nothing; the app says so and uses it for no rule.

## Bonus prizes

- **Best Agents.** `rovo:agent` "Handoff Guard" with five `action` modules, and a `rovo:skill` ("Handoff check") that other agents can use. The agent explains and proposes; the rule check decides.
- **Best app with MCP.** One `rovo:mcp` module exposes the same five actions as tools to external MCP clients, run with the calling user's permissions.
- **Best apps with Teamwork Graph integration.** The app consumes the Teamwork Graph API: two saved Cypher queries, called as the current user, return people the work item was shared with or who are mentioned on it.

## Links

- Video: (owner adds)
- Repository: https://github.com/hoachauphuoc/handoff-guard
- Installation link: (owner adds)

