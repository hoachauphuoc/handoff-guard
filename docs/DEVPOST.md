# Devpost submission draft

Owner submits. Category: Apps for Software Teams. Bonus prizes: Best Agents (rovo:agent and five actions), Best app with MCP (rovo:mcp), Best apps with Teamwork Graph integration.

## Tagline

Rules decide whether a Jira handoff is safe; Rovo explains why.

## Inspiration

When a work item changes hands, the decisions that bind it (a deadline, a required review, a component nobody may touch) stay in someone's head, a page or a comment. The next person finds out late.

## What it does

- **Handoff check.** The panel on a work item records a handoff to a named receiver and runs plain rules: the item must have a description and a due date, must not contradict any recorded decision, and the receiver must acknowledge every decision that binds it. The verdict is Clear, Needs info or Blocked.
- **Suggested fixes.** The smallest edits that would stop the item contradicting its decisions (a due date, a label to add, a component to remove). Advice only; the app never edits the work item.
- **Rovo agent.** Explains the verdict, quoting the rule check's sentence exactly. It finds decisions written in the description and comments and proposes them with a word-for-word quote as evidence. A proposal binds nothing until a person confirms it in the panel. A repeat of a confirmed decision is rejected.
- **Handoff brief.** Pulls what the receiver needs, including people connected to the item from Teamwork Graph (shared with, mentioned). Advisory; no rule reads it.
- **Workflow validator.** A transition with the validator only goes through when the handoff is Clear.
- **I-PASS structure.** The panel follows the I-PASS handoff protocol over the rule check: a severity label beside the verdict, a patient-summary brief, an action list with an owner per finding, an optional "if ... then ..." contingency from the sender, and one read-back from the receiver. The rule check stays the only thing that decides.
- **Teach-back.** A read-back that addresses a decision but contradicts it (a date past the limit, a required label said to be skipped, a forbidden one said to be added) is refused by plain code. One sentence beside the refusal, telling the receiver what to write instead, is written by a model through Forge LLMs and labelled as model-written; it never makes or lifts a refusal.
- **Handoff drift.** If the due date, a label or a component that a decision reads changes after the receiver acknowledged it, the acknowledgement goes stale and the panel shows what changed.
- **Replay on a date.** The Decisions page shows which prepared handoffs would have had a different verdict on an earlier date, using the decisions and acknowledgements as they stood then.
- **Superseding decisions.** A decision that makes older ones redundant, or moves a deadline, can be confirmed with the older ones retired (only those the confirming person may supersede); the person who confirmed a decision can also retire it from the Decisions page. A superseded decision binds nothing.
- **Rovo MCP server.** The same five actions are exposed through the `rovo:mcp` module for external agents.
- **Jira-only.** The app declares no Confluence scope and installs on any Jira site.

## How we built it

Forge (UI Kit, resolvers, Forge storage), a pure TypeScript rule core with no Forge imports, `rovo:agent` with five actions, `rovo:mcp`, `jira:workflowValidator`, and two saved Teamwork Graph Cypher queries called with `asUser()`. 287 unit tests. Only decisions and handoff records are stored; no chat is stored.

## Measurement

48 synthetic handoffs, labeled by a model (Muse). Agreement with Muse labels: 47 of 48 with recorded decisions, 34 of 48 with the rules alone, 12 of 48 with no check. This is agreement with model-written labels, not accuracy.

## Challenges

- Keeping the model out of the verdict: Rovo may only quote and explain, so the rule result is passed through untouched and the prompts forbid predicting it.
- Evidence that cannot be invented: a proposed decision is kept only when its quote is found word for word in the work item, read again as the caller.
- Teamwork Graph returns empty rows rather than errors when a scope or permission is missing, so the UI says "returned nothing" and never treats it as a fact.

## What's next

Watch more sources for decisions, and let teams share decisions across projects.

## Links

- Video: (owner adds)
- Repository / install link: (owner adds)
