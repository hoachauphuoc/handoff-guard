"""Dev-only: turn the Toloka export into data/human_labels.json (owner's decision, 2026-11-13).

Human labels are a second source beside the Muse labels in data/labels.json; they never overwrite it.
A case is decided only when a strict majority of its annotators gave the same answer. Anything else
is "unresolved" and is reported as such, never settled by a coin toss or by the Muse label.

  python scripts/import_human_labels.py [export.json]
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_EXPORT = ROOT / "data" / "toloka" / "raw" / "export.json"
MUSE_LABELS = ROOT / "data" / "labels.json"
OUT = ROOT / "data" / "human_labels.json"
VERDICTS = ("clear", "needs_info", "blocked")


def decide(answers: list[str]) -> str:
    top, count = Counter(answers).most_common(1)[0]
    return top if count * 2 > len(answers) else "unresolved"


def main() -> None:
    export = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_EXPORT
    rows = json.loads(export.read_text(encoding="utf-8"))
    muse = {l["id"]: l["verdict"] for l in json.loads(MUSE_LABELS.read_text(encoding="utf-8"))}

    entries = []
    for row in rows:
        answers = row["output"]["answer"]
        if row["status"] != "completed" or not answers or any(a not in VERDICTS for a in answers):
            raise SystemExit(f"{row['input']['id']}: not a completed row with valid answers")
        entries.append({
            "id": row["input"]["id"],
            "answers": answers,
            "verdict": decide(answers),
            "by": "toloka-experts",
        })

    decided = [e for e in entries if e["verdict"] != "unresolved"]
    both_muse = [e for e in decided if muse.get(e["id"]) == e["verdict"]]
    unanimous = [e for e in entries if len(set(e["answers"])) == 1]
    summary = {
        "cases": len(entries),
        "unanimous": len(unanimous),
        "decided": len(decided),
        "unresolved": len(entries) - len(decided),
        "decidedMatchingMuse": len(both_muse),
    }
    OUT.write_text(json.dumps({"synthetic": True, "summary": summary, "labels": entries}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
