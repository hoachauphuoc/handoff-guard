# CLAUDE.md

Handoff Guard: a Forge app for Atlassian Codegeist 2026. When a Jira work item is handed to someone else, rules check what is missing and which recorded decisions bind it. Solo entry. Submission due 2026-12-22 12:00 PT (2026-12-23 03:00 Vietnam).

- Plan: `C:/Users/phuochoa/.claude/plans/zippy-humming-castle.md`. Progress between sessions: `docs/PROGRESS.md`.

## Working rules

- The owner has 1-2 hours a day. Do the work; end every session with a short summary and "Việc của bạn (≤15 phút)".
- Reply to the owner in Vietnamese, briefly. Everything in the product (UI, prompts, data, README, video) is English.
- Git: local commits per finished slice are allowed. `origin` is the owner's public repo github.com/hoachauphuoc/handoff-guard; no push until the owner orders it in that message. No co-author line.
- Never read, print or commit tokens. `forge login` is run by the owner.
- Claude may run `forge deploy -e development` and `forge install` on the owner's dev site after the owner has logged in. Production deploys, Marketplace submission and the Devpost submission are the owner's.
- No company business data, real customer names or employer material anywhere in this repo.

## Dev-only tools (never in `src/`, never in the product)

| Runner | Role | Does not do |
|---|---|---|
| Claude Fable | Splits work between the runners, writes their briefs, reviews every diff, commits, deploys to development | Bulk generation, labels |
| Claude Opus | Rule and measure design, risk spikes, review before commit, final pass on README and video script | Bulk generation |
| Claude Sonnet | Day-to-day implementation: Forge UI, resolvers, tests, `scripts/`. Also the second voice: adversarial samples and critique of the rules, README and video script | Changing rule semantics without an Opus-level review; labels |
| Claude Haiku | Mechanical work: search, lint fixes, running `check.ps1`, progress notes | Design, labels |
| Muse Spark (`muse-spark-1.3-contributor`) | Bulk sample generation, sample labels | Deciding the product's verdict; critique that needs judgement |
| Muse Wonder (`muse-wonder-1.0`, owner's decision 2026-11-13) | First critic of README, Devpost text and video script; research with Tavily | Deciding the product's verdict; labels; anything in `src/` |
| Tavily | Fresh Forge/Rovo docs on demand | Anything else |

- Labels: Muse labels the samples (owner's decision, 2026-11-12; `scripts/label_samples.py`, each entry marked `by`). An owner label always overrides and is never overwritten. Claude does not write labels.
- Human labels (owner's decision, 2026-11-13): a Toloka pilot, 3 annotators per case, budget cap USD 30, adds to the Muse labels as a second source; it does not replace them. Brief: `docs/toloka-brief.md`, upload: `data/toloka/cases.json`. The owner runs the Toloka account and approves every spend. One exception to "Claude does not write labels": the 5 Exam control answers in `data/toloka/controls.json` were filled by Claude on the owner's request (marked `by`); they gate annotators and are never used as measurement labels.
- README must say the samples are synthetic and the labels are model-written, and must call the figure "agreement with Muse labels", not accuracy.
- Endpoints and model IDs: `scripts/models.json`. Generator: `scripts/gen_samples.py`.
- Keys live outside the repo in `C:\Users\phuochoa\.bjt\` (`Muse.txt`, `tavily_api_key.txt`; Baseten and Modal are not used), read by `scripts/` only. Claude never opens, prints or copies these files. Never put key values in CLAUDE.md or any tracked file.

## Product principles (each has a test)

1. Rules decide the verdict, the model writes words: `checkHandoff()` is plain code; Rovo only explains findings.
2. A `clear` verdict never carries a finding.
3. No silent substitution: when Rovo or Teamwork Graph is unavailable, the UI names the source of the result.
4. No chat storage: only decisions and handoffs (work records) are stored, in Forge storage.
5. README figures come only from `scripts/measure`.

## Code

- TypeScript, Forge (UI Kit), vitest. `src/rules/` is pure: no Forge imports, no network, no clock (time is passed in).
- One command: `powershell -File scripts/check.ps1`.
- Comments say why, not what. No dead code, no speculative helpers, no new dependency without a reason.
