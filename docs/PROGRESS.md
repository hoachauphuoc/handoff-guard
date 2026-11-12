# Progress

## Next
1. Owner: register on Devpost, create the Atlassian developer site, run `forge login`.
2. Register the Forge app and add `manifest.yml` (issue panel hello world); add `forge lint` to `scripts/check.ps1`.
3. Risk spikes: Rovo agent on the dev site, Teamwork Graph query, `rovo:mcp`, workflow validator.
4. Owner decides the open rule questions below, then labels `data/samples/` (38 Muse + 10 Sonnet adversarial). Then build `scripts/measure`.

## Open rule questions (from the Sonnet critique; owner decides, then code and tests follow)
1. Dates are compared as strings: an unpadded `2026-2-9` counts as later than `2026-11-30`. Validate the format?
2. Labels, components and person ids match exactly: `Safety-Review ` is not `safety-review`, `u-Ana` is not `u-ana`. Normalize case and whitespace?
3. A missing sender (`fromId` null) is never flagged.
4. Filler descriptions such as "tbd" pass; only empty or whitespace-only is flagged.
5. A binding decision with no constraints still requires acknowledgement.
6. A superseded decision disappears from `binding`; the receiver never sees what replaced it.

## Log
### 2026-11-12, Day 1
- Repo scaffold: CLAUDE.md, TypeScript, vitest, `scripts/check.ps1`.
- First rule-core slice: `checkHandoff()` with 6 rules and 3 constraint kinds; 9 tests pass.
- Forge CLI is not installed yet; no manifest yet.
- Dev-only model roles recorded in CLAUDE.md. `scripts/gen_samples.py` + `scripts/models.json` added; Muse dry run produced 2 valid unlabeled samples ($0.0006).
- Muse generated 30 valid unlabeled samples ($0.0072). Baseten slug set to `meta-models/muse-spark-open-1026`; the call failed (model deactivated), no Baseten samples yet.
- Baseten dropped for Modal. `gen_samples.py` now sends all batches in parallel (`--workers`, default 8) and logs wall-clock seconds; verified with Muse (6/6 samples, 2 batches). Modal not run yet: no endpoint URL. Muse total: 38 unlabeled samples in 3 files.
- Modal dropped too. Claude Sonnet is the second voice: it wrote 10 unlabeled adversarial samples (`data/samples/sonnet-adversarial.json`, shape check passes) and a critique of the rules. `gen_samples.py` is Muse-only again, with `--validate` for hand-written sample files.
