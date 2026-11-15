# Claude plugins used on this project

Dev-only. Nothing here is in `src/` or in the product. Cheapest runner first (see `CLAUDE.md`); a plugin is used when its skill saves more tokens than it costs to load.

| Plugin (Claude desktop) | Used for | When |
|---|---|---|
| `agentic-council` (`/council`, Skeptic, Advocate, Strategist, Operator, Guardian, Craftsman, Scout) | Judge-panel reviews of the idea, the code and the docs; release gate | Before a release, before filming, when the owner orders a council |
| `tavily` | Fresh Forge, Rovo and Marketplace facts; market notes (`docs/MARKET.md`) | When a claim needs a source; raw results go to the ignored `research/` folder |
| `engineering` (`code-review`, `debug`, `deploy-checklist`, `testing-strategy`) | A second reading of a diff, a checklist before a production deploy | Rule changes and deploys |
| `design` (`accessibility-review`, `ux-copy`, `design-critique`) | The keyboard and screen-reader pass, wording of panel text | Before the code freeze (2026-12-10) |
| `product-management` (`write-spec`, `competitive-brief`) | Pilot protocol, pricing hypothesis | Only when the owner asks |
| `anthropic-skills:built-in-browser` | Checking the panel and the Decisions page on the demo site | After each deploy |
| `agent-handoff` (`plan`, `execute`, `verify`, `setup-handoff`) | Splitting a plan between a planner and an executor session | When a change is big enough for a plan file and a separate executor |
| `operations` (`runbook`, `risk-assessment`, `change-request`, `status-report`) | Release runbook, risk list before the production deploy, status line for the owner | Release and filming weeks |
| `data` (`validate-data`, `statistical-analysis`, `analyze`) | Checking the sample sets and the label-agreement figures before they reach the README | When `data/` or `scripts/measure` changes |
| `render` (`render-debug`, `render-static-sites`) | Only if a static page for the demo or privacy policy is hosted | Optional, Marketplace listing needs a privacy URL |
| `sales` (`competitive-intelligence`, `draft-outreach`, `call-prep`) | Competitor notes, and asking pilot teams about price | After the code freeze, with the owner's approval for any outreach |
| `desktop-commander` (`terminal`, `knowledge-base`) | Long local commands and file work outside the repo | Rare; the built-in tools cover most of it |
| `productivity` (`task-management`, `memory-management`) | The owner's daily list and the memory files | Daily sessions |
| `anthropic-skills` (`pdf`, `docx`, `pptx`, `xlsx`, `skill-creator`) | A slide deck or PDF of the pitch if a judge asks for one | Only on request |

All the plugins installed in Claude desktop are listed. A plugin that adds skills to every session's list costs tokens whether or not it is used, so the first group above is the one in routine use and the rest are called by name when a task fits.

## Rules that stay in force

- Plugin agents are Claude subagents: CLAUDE.md forbids them unless the owner asks in that message ("giao hội đồng giám khảo" counts). Use `sonnet` for reviews, `opus` only for a decision.
- A review is read-only: no edits, deploys or commits by the reviewer, and no reading of `C:\Users\phuochoa\.bjt\`.
- Executors (Muse Code, Gemini) and their scripts are listed in `CLAUDE.md`; plugins do not replace them for file-writing work.
- Plugin output is advice. Claude reads the diff, runs `scripts/check.ps1`, and commits.
- Nothing from a plugin is shipped: no plugin text goes into the README or the video unless it was checked against a source.

## Why no committed plugin settings

`.claude/` is ignored by git on purpose, so the public repo carries no private tool configuration. A clone of the repo builds and tests with `npm` and `scripts/check.ps1` alone; the plugins are a convenience for the owner's desktop.
