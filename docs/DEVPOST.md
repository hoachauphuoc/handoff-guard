# Devpost submission draft

Owner submits. Category: Apps for Software Teams. Bonus prizes: Best Agents (rovo:agent and four actions), Best app with MCP (rovo:mcp), Best apps with Teamwork Graph integration.

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
- **Rovo MCP server.** The same four actions are exposed through the `rovo:mcp` module for external agents.

## How we built it

Forge (UI Kit, resolvers, Forge storage), a pure TypeScript rule core with no Forge imports, `rovo:agent` with four actions, `rovo:mcp`, `jira:workflowValidator`, and two saved Teamwork Graph Cypher queries called with `asUser()`. 131 unit tests. Only decisions and handoff records are stored; no chat is stored.

## Measurement

48 synthetic handoffs, labeled by a model (Muse). Agreement with Muse labels: 47 of 48 with recorded decisions, 34 of 48 with the rules alone, 12 of 48 with no check. This is agreement with model-written labels, not accuracy.

## Challenges

- Keeping the model out of the verdict: Rovo may only quote and explain, so the rule result is passed through untouched and the prompts forbid predicting it.
- Evidence that cannot be invented: a proposed decision is kept only when its quote is found word for word in the work item, read again as the caller.
- Teamwork Graph returns empty rows rather than errors when a scope or permission is missing, so the UI says "returned nothing" and never treats it as a fact.

## What's next

Read decisions from Confluence pages, and let a team mark a decision superseded from the panel.

## Links

- Video: (owner adds)
- Repository / install link: (owner adds)
