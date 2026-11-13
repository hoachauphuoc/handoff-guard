"""Dev-only: Muse Spark writes receiver read-backs against the sample decisions, each with Spark's own tag.

The tags are Muse labels (marked `by`), used only to find read-backs where the teach-back code and Muse
disagree. They decide nothing in the product. Standard library only.

  python scripts/gen_readbacks.py --count 200
"""
import argparse
import concurrent.futures
import json
import pathlib
import sys
from datetime import datetime, timezone

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from gen_samples import ROOT, call, parse_array  # noqa: E402

OUT = ROOT / "data" / "readbacks"
BATCH = 20

PROMPT = """A work item is handed to a new owner on 2026-12-01. Three recorded team decisions bind it:
- d-sample-1 "Work ships by the end of 2026": the due date must not be later than 2026-12-31.
- d-sample-2 "Stop using the legacy billing component": the component legacy-billing is forbidden.
- d-sample-3 "Launch work needs legal review": the label legal-reviewed is required.

The receiver must write a read-back: one short paragraph (40 to 300 characters) in their own words saying what
they will do. Write {n} different read-backs as different people would: terse engineer, careful project manager,
rushed support agent, new joiner, non-native English speaker. Every read-back must mention all three decisions,
by title or by the date, component or label. About half must agree with all three decisions. The rest must
contradict exactly one decision, in varied ways: a later ship date (with or without a year), saying the review
or label will be skipped, is optional or not needed, or saying the legacy component will still be used or added.
Include hard cases: double negatives, "can't skip", "no problem", "stop using", "keep ... off", dates in many
formats, a decision title repeated word for word.

Return only a JSON array, no prose, no code fence. Each element:
{{"text": string, "tag": "agrees" | "contradicts", "contradicts": null | "d-sample-1" | "d-sample-2" | "d-sample-3"}}"""


def one_batch(cfg: dict, n: int) -> list:
    out = call(cfg, "/chat/completions", {"model": cfg["model"], "messages": [{"role": "user", "content": PROMPT.format(n=n)}]})
    content = out["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = " ".join(p.get("text", "") for p in content if isinstance(p, dict))
    rows = parse_array(content)
    ok = [r for r in rows if isinstance(r, dict) and isinstance(r.get("text"), str) and r.get("tag") in ("agrees", "contradicts")]
    return [{"text": r["text"].strip(), "tag": r["tag"], "contradicts": r.get("contradicts"), "by": cfg["model"]} for r in ok]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=200)
    a = ap.parse_args()
    cfg = json.loads((ROOT / "scripts" / "models.json").read_text(encoding="utf-8"))["muse"]
    batches = [BATCH] * (a.count // BATCH)
    rows, failed = [], 0
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        for fut in [pool.submit(one_batch, cfg, n) for n in batches]:
            try:
                rows += fut.result()
            except Exception as e:  # one bad batch must not lose the others
                failed += 1
                print(f"batch failed: {e}", file=sys.stderr)
    seen, unique = set(), []
    for r in rows:
        if r["text"] not in seen:
            seen.add(r["text"])
            unique.append(r)
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"spark-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    path.write_text(json.dumps(unique, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="")
    tags = {t: sum(1 for r in unique if r["tag"] == t) for t in ("agrees", "contradicts")}
    print(f"{len(unique)} read-backs ({tags}), {failed} failed batches -> {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
