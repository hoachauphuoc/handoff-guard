# Pipeline: which plugins run when

Dev-only. Plugins are Claude skills, so a script cannot run them; `scripts/pipeline.ps1 <stage>` runs the mechanical gates of a stage (the ones code can decide) and prints the plugin steps still to run. A session then runs those steps, in order, and stops at the first gate that fails. Which plugin does what is in `docs/TOOLING.md`.

```
powershell -File scripts/pipeline.ps1 daily        # every working day
powershell -File scripts/pipeline.ps1 release      # before any production deploy
powershell -File scripts/pipeline.ps1 filming      # from 2026-12-15
powershell -File scripts/pipeline.ps1 submission   # before the owner submits
```

## Stages

| Stage | Mechanical gates (script) | Plugin steps (a session runs them) |
|---|---|---|
| `daily` | `scripts/check.ps1`, clean `git status` report | `productivity:task-management` for the day's list; `engineering:code-review` on the day's diff if `src/rules/` changed |
| `release` | `scripts/check.ps1`, no uncommitted `src/`, `forge lint` | `agentic-council` release gate (Operator, Skeptic, Guardian, Craftsman, read-only, sonnet); `engineering:deploy-checklist`; `operations:risk-assessment`; after deploy `anthropic-skills:built-in-browser` check of the panel and the Decisions page; `data:validate-data` if `data/` or `scripts/measure` changed |
| `filming` | everything in `release`, plus the filming checklist printed from `docs/VIDEO.md` | `design:accessibility-review` (keyboard and screen reader); `design:ux-copy` on panel text; `agentic-council` Advocate on `docs/VIDEO.md`; `operations:runbook` for the demo site state |
| `submission` | everything in `release`, plus a search of the public files for tokens and company words | `agentic-council` full judge panel (Strategist, Advocate, Skeptic) on `docs/DEVPOST.md` and the README; `tavily` for any claim that needs a fresh source; the owner submits |

From 2026-12-15 only the `release`, `filming` and `submission` stages are used, and only for fixes that the video or a judge would hit (CLAUDE.md).

## Prompts for the plugin steps

A session can paste these as they are. Each review is read-only and each reviewer is told not to touch `C:\Users\phuochoa\.bjt\`.

- **Release gate:** "Giao hội đồng giám khảo kiểm tra như một production chuẩn bị release": four agents (Operator, Skeptic, Guardian, Craftsman), `model: sonnet`, each returns GO or NO-GO, findings with file:line and the exact fix.
- **Deploy checklist:** `engineering:deploy-checklist` for the development deploy, then the production deploy and `forge install --upgrade -e production`.
- **Panel check:** open the Decisions page and the MOBL-58 panel in the built-in browser and read what is on screen against the README.
- **Judge panel:** "Judge Handoff Guard as a Codegeist 2026 panel" with Strategist, Advocate and Skeptic; score each criterion and list fixes that need no new feature.
- **Market claim:** a Tavily search, then a Scout check of each figure against the live page; a figure that cannot be confirmed is dropped.

## Rules

- Council agents run only when the owner has asked for them in that message (CLAUDE.md); `release` and `submission` count as that ask only if the owner says so.
- A gate that fails stops the stage; the fix is its own commit, then the stage starts again.
- Plugin output is advice. Claude reads the diff and decides; Opus decides only a question the owner has put to it.
- Production deploys follow the owner's standing order (checked fix, then deploy); Marketplace and Devpost submissions are the owner's.
