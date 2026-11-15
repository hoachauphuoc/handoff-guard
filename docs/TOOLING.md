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

Not used on this project: `sales`, `data`, `render`, `operations`, `desktop-commander`, `productivity`. They add skills to every session's list and cost tokens for no gain here.

## Rules that stay in force

- Plugin agents are Claude subagents: CLAUDE.md forbids them unless the owner asks in that message ("giao hội đồng giám khảo" counts). Use `sonnet` for reviews, `opus` only for a decision.
- A review is read-only: no edits, deploys or commits by the reviewer, and no reading of `C:\Users\phuochoa\.bjt\`.
- Executors (Muse Code, Gemini) and their scripts are listed in `CLAUDE.md`; plugins do not replace them for file-writing work.
- Plugin output is advice. Claude reads the diff, runs `scripts/check.ps1`, and commits.
- Nothing from a plugin is shipped: no plugin text goes into the README or the video unless it was checked against a source.

## Why no committed plugin settings

`.claude/` is ignored by git on purpose, so the public repo carries no private tool configuration. A clone of the repo builds and tests with `npm` and `scripts/check.ps1` alone; the plugins are a convenience for the owner's desktop.
