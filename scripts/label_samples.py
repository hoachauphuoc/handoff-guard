"""Dev-only: let Muse label the unlabeled entries in data/labels.json (owner's decision, 2026-11-12).

These are model labels, not ground truth. Every entry Muse fills is marked with "by", and an
entry that already has a verdict is never touched, so owner labels always win.

  python scripts/label_samples.py
"""
import concurrent.futures
import json
import sys
from datetime import datetime, timezone

from gen_samples import OUT_DIR, ROOT, call

LABELS = ROOT / "data" / "labels.json"
VERDICTS = ("clear", "needs_info", "blocked")

# The policy in plain words, not the code: Muse judges the case, it does not re-run checkHandoff().
POLICY = """You review the handoff of a Jira work item from one person to another, together with
the team decisions on record. Answer with exactly one word:

blocked     the handoff must not go ahead: there is no receiver, the sender and receiver are the
            same person, or the work item breaks a decision that is in force and applies to it
needs_info  nothing forbids the handoff, but something is missing: the sender, a real description,
            a valid due date, or the receiver's acknowledgement of a decision that applies
clear       the handoff can go ahead as it is

A decision applies only when it is in force (not superseded) and its scope matches the work item.
People type ids, labels and components by hand, so ignore differences in letter case and
surrounding spaces. Dates must be real YYYY-MM-DD dates."""


def label(cfg: dict, sample: dict) -> tuple[str | None, int, int]:
    res = call(cfg, "/chat/completions", {
        "model": cfg["model"],
        "messages": [
            {"role": "system", "content": POLICY},
            {"role": "user", "content": json.dumps({"handoff": sample["handoff"], "decisions": sample["decisions"]})},
        ],
    })
    usage = res.get("usage") or {}
    words = (res["choices"][0]["message"]["content"] or "").strip().lower().strip(".`\"' ").split()
    verdict = words[-1] if words and words[-1] in VERDICTS else None
    return verdict, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)


def main() -> None:
    cfg = json.loads((ROOT / "scripts" / "models.json").read_text(encoding="utf-8"))["muse"]
    labels = json.loads(LABELS.read_text(encoding="utf-8"))
    todo = [l for l in labels if l["verdict"] is None]

    files: dict[str, list] = {}
    def sample_of(entry_id: str) -> dict:
        name, index = entry_id.split("#")
        if name not in files:
            files[name] = json.loads((OUT_DIR / name).read_text(encoding="utf-8"))["samples"]
        return files[name][int(index)]

    tok_in = tok_out = failed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(label, cfg, sample_of(l["id"])): l for l in todo}
        for fut in concurrent.futures.as_completed(futures):
            entry = futures[fut]
            try:
                verdict, ti, to = fut.result()
            except (RuntimeError, KeyError, IndexError, TypeError) as e:
                failed += 1
                print(f"{entry['id']} failed: {e}")
                continue
            tok_in += ti
            tok_out += to
            if verdict is None:
                failed += 1
                continue
            entry["verdict"] = verdict
            entry["by"] = cfg["model"]

    LABELS.write_text(json.dumps(labels, indent=2) + "\n", encoding="utf-8")
    cost = round((tok_in * cfg["usdPerMTokIn"] + tok_out * cfg["usdPerMTokOut"]) / 1e6, 6)
    with (OUT_DIR / "cost.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "at": datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"), "task": "label",
            "model": cfg["model"], "labeled": len(todo) - failed, "failed": failed,
            "tokensIn": tok_in, "tokensOut": tok_out, "usd": cost,
        }) + "\n")
    print(f"labeled {len(todo) - failed}/{len(todo)}; failed {failed}; tokens {tok_in}/{tok_out}; usd {cost}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
