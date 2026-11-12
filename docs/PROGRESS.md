# Progress

## Next
1. Owner: register on Devpost.
2. After any scope change: `forge install --upgrade -e development --site hoachauphuoc.atlassian.net --product jira`.
3. Risk spikes: Rovo agent on the dev site, Teamwork Graph query, `rovo:mcp`, workflow validator.
4. Owner fills `"verdict"` (`clear`, `needs_info` or `blocked`) for the 48 entries in `data/labels.json`, then `npm run measure`. Each disagreement is either a rule bug or a label to reconsider.
5. Panel semantics: the preview hands the item "from the viewer to the current assignee", so a self-assigned item reads "same person". Next product slice: pick the receiver in the panel, and store decisions so the panel has something to bind.

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
- Dev site set up with the owner's approval: team-managed Kanban space "Ops Demo" (key `OPS`) and work item `OPS-1` "Launch the spring campaign". Panel verified on `OPS-1` (unassigned, no description, no due date): verdict Blocked with "no receiver", "description is empty", "no due date", and the source line. End to end works: Jira -> resolver -> `checkHandoff()` -> UI.
- `OPS-1` then got an assignee (the owner) and a description: panel changed to Blocked with "same person" and "no due date". The due date could not be set through the in-app browser (Jira's date field ignored the input), so the clear state has not been seen on the site.
- `scripts/measure.ts` (`npm run measure`, runs on Node 24 directly, no new dependency) and `data/labels.json` with 48 unlabeled entries. Labels are never prefilled from rule output.
