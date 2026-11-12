# Progress

## Next
1. Owner: open a work item on `hoachauphuoc.atlassian.net` and confirm the Handoff Guard panel shows a verdict (not yet seen running). Register on Devpost.
2. After any scope change: `forge install --upgrade -e development --site hoachauphuoc.atlassian.net --product jira`.
3. Risk spikes: Rovo agent on the dev site, Teamwork Graph query, `rovo:mcp`, workflow validator.
4. Owner labels `data/samples/` (38 Muse + 10 Sonnet adversarial). Then build `scripts/measure`.

## Rule decisions (owner, 2026-11-12, after the Sonnet critique)
- Fixed: a malformed due date is reported (`invalid_due_date`) instead of compared; labels, components and person ids match ignoring case and outer spaces; a missing sender is reported (`no_sender`, info_needed).
- Kept as is: filler descriptions such as "tbd" pass; a binding decision with no constraints still needs acknowledgement; a superseded decision is not shown.
- Not covered yet: a malformed date inside a decision's `dueNotAfter` constraint; project keys and work-item keys still match exactly.

## Log
### 2026-11-12, Day 1
- Repo scaffold: CLAUDE.md, TypeScript, vitest, `scripts/check.ps1`.
- First rule-core slice: `checkHandoff()` with 6 rules and 3 constraint kinds; 9 tests pass.
- Forge CLI is not installed yet; no manifest yet.
- Dev-only model roles recorded in CLAUDE.md. `scripts/gen_samples.py` + `scripts/models.json` added; Muse dry run produced 2 valid unlabeled samples ($0.0006).
- Muse generated 30 valid unlabeled samples ($0.0072). Baseten slug set to `meta-models/muse-spark-open-1026`; the call failed (model deactivated), no Baseten samples yet.
- Baseten dropped for Modal. `gen_samples.py` now sends all batches in parallel (`--workers`, default 8) and logs wall-clock seconds; verified with Muse (6/6 samples, 2 batches). Modal not run yet: no endpoint URL. Muse total: 38 unlabeled samples in 3 files.
- Modal dropped too. Claude Sonnet is the second voice: it wrote 10 unlabeled adversarial samples (`data/samples/sonnet-adversarial.json`, shape check passes) and a critique of the rules. `gen_samples.py` is Muse-only again, with `--validate` for hand-written sample files.
- Rule fixes from the critique: `no_sender`, `invalid_due_date`, case/space-insensitive matching. 8 rules, 12 tests pass.
- Forge slice written, not registered or deployed: `manifest.yml` (issue panel, `read:jira-work`), resolver `previewHandoff` that runs `checkHandoff()` on the open work item, UI Kit panel. Typecheck passes. `forge register` stopped: the account has no Developer Space and the prompt needs a real terminal. Manifest app id is a placeholder until then, so `forge lint` cannot run.
- Owner registered the app (Developer Space "PhuocHoa Dev"). `forge lint` clean and now part of `scripts/check.ps1`. Deployed to development (eligible for Runs on Atlassian). `noEmit` moved out of `tsconfig.json` because the Forge bundler needs emitted output; the typecheck script still passes `--noEmit`. Not installed on any site yet.
- Installed the development build in Jira on `hoachauphuoc.atlassian.net` (scope `read:jira-work`). The panel has not been observed on a work item: the in-app browser is not signed in to the site.
