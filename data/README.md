# Data

Everything here is synthetic: no real work item, customer or person. The handoffs were written by models from our own specification, and so were most of the labels. Figures computed from this data are agreement with labels, not accuracy (see the README, "Measurement").

| Path | What it is | Written by |
|---|---|---|
| `samples/muse-*.json` | 38 synthetic handoffs: a work item, sender, receiver, decisions and acknowledgements | Muse (`scripts/gen_samples.py`) |
| `samples/sonnet-adversarial.json` | 10 adversarial handoffs meant to trip the rule check | Claude Sonnet |
| `samples/cost.jsonl` | One line per generation run: model, sample count, tokens and cost | `scripts/gen_samples.py` |
| `labels.json` | The expected verdict for each of the 48 samples, each entry marked `by`; an owner label always wins and is never overwritten | Muse (`scripts/label_samples.py`) |
| `human_labels.json` | Verdicts from a paid human pilot on Toloka (two annotators per sample, 2026-11-13), with the cases they did not agree on marked unresolved | `scripts/import_human_labels.py` from `toloka/raw/export.json` |
| `toloka/cases.json`, `toloka/controls.json` | What was uploaded to Toloka; the 5 controls gate annotators and are never used as measurement labels | Claude, on the owner's request |
| `toloka/raw/export.json` | Toloka's export, with annotator and run ids removed | Toloka |
| `readbacks/spark-*.json` | Synthetic read-backs, each tagged as agreeing with or contradicting a decision, for testing the read-back check | Muse (`scripts/gen_readbacks.py`) |

`scripts/measure.ts` (`npm run measure`) compares `checkHandoff()` with `labels.json` and `human_labels.json`; it is the only source of the README figures, and `scripts/check.ps1` fails when the README table and its output differ.
