# CLAUDE.md

Handoff Guard: a Forge app for Atlassian Codegeist 2026. When a Jira work item is handed to someone else, rules check what is missing and which recorded decisions bind it. Solo entry. Submission due 2026-12-22 12:00 PT (2026-12-23 03:00 Vietnam).

- Plan: `C:/Users/phuochoa/.claude/plans/zippy-humming-castle.md`. Progress between sessions: `docs/PROGRESS.md`.

## Working rules

- The owner has 1-2 hours a day. Do the work; end every session with a short summary and "Việc của bạn (≤15 phút)".
- Reply to the owner in Vietnamese, briefly. Everything in the product (UI, prompts, data, README, video) is English.
- Git: local commits per finished slice are allowed. No remote, no push until the owner orders it in that message. No co-author line.
- Never read, print or commit tokens. `forge login` is run by the owner.
- Claude may run `forge deploy -e development` and `forge install` on the owner's dev site after the owner has logged in. Production deploys, Marketplace submission and the Devpost submission are the owner's.
- No company business data, real customer names or employer material anywhere in this repo.

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
