# Progress

## Next
1. Owner: register on Devpost, create the Atlassian developer site, run `forge login`.
2. Register the Forge app and add `manifest.yml` (issue panel hello world); add `forge lint` to `scripts/check.ps1`.
3. Risk spikes: Rovo agent on the dev site, Teamwork Graph query, `rovo:mcp`, workflow validator.
4. Baseten: `meta-models/muse-spark-open-1026` returns HTTP 400 "model version is deactivated". Owner activates it or picks another slug; then generate 10 adversarial samples.
5. Owner labels `data/samples/`, then build `scripts/measure`.

## Log
### 2026-11-12, Day 1
- Repo scaffold: CLAUDE.md, TypeScript, vitest, `scripts/check.ps1`.
- First rule-core slice: `checkHandoff()` with 6 rules and 3 constraint kinds; 9 tests pass.
- Forge CLI is not installed yet; no manifest yet.
- Dev-only model roles recorded in CLAUDE.md. `scripts/gen_samples.py` + `scripts/models.json` added; Muse dry run produced 2 valid unlabeled samples ($0.0006).
- Muse generated 30 valid unlabeled samples ($0.0072). Baseten slug set to `meta-models/muse-spark-open-1026`; the call failed (model deactivated), no Baseten samples yet.
