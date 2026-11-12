"""Dev-only: generate UNLABELED synthetic handoff samples for the measure set.

Models propose samples; labels come from the rules or the owner, never from a model.
Standard library only, so the repo gains no dependency for a dev script.

  python scripts/gen_samples.py --provider muse --count 30
  python scripts/gen_samples.py --provider baseten --count 10
  python scripts/gen_samples.py --provider baseten --list-models
"""
import argparse
import json
import pathlib
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
KEY_DIR = pathlib.Path.home() / ".bjt"
OUT_DIR = ROOT / "data" / "samples"
BATCH = 5

SCHEMA = """Each sample is a JSON object:
{
  "note": string,            // one line: what makes this case interesting
  "handoff": {
    "item": {
      "key": string,         // like "OPS-12"
      "projectKey": string,
      "summary": string,
      "description": string, // may be empty
      "labels": string[],
      "components": string[],
      "dueDate": "YYYY-MM-DD" | null,
      "assigneeId": string | null
    },
    "fromId": string | null,
    "toId": string | null,
    "acknowledged": string[] // decision ids the receiver says they have read
  },
  "decisions": [{
    "id": string,
    "title": string,
    "status": "decided" | "superseded",
    "source": {"kind": "confluence" | "jira" | "ledger", "ref": string},
    "scope": {"kind": "project", "projectKey": string}
           | {"kind": "label", "label": string}
           | {"kind": "workItem", "key": string},
    "constraints": [
        {"kind": "dueNotAfter", "date": "YYYY-MM-DD"}
      | {"kind": "labelRequired", "label": string}
      | {"kind": "componentForbidden", "component": string}
    ]
  }]
}"""

COMMON = (
    "You write synthetic test data for a tool that checks Jira work-item handoffs "
    "against recorded team decisions. Invent everything: fictional teams, people ids like "
    "'u-ana', and projects. Never use a real company, product or person name. English only. "
    "Do not say whether the handoff is acceptable; only write the data.\n\n"
    + SCHEMA
    + "\n\nReturn only a JSON array of {n} samples, no prose, no code fence."
)

STYLE = {
    "muse": (
        "Vary the writing voice across samples: terse engineer, careful project manager, "
        "rushed support agent, new joiner. Mix clean handoffs with ones missing a receiver, "
        "a description, a due date, or an acknowledgement, and ones that break a decision."
    ),
    "baseten": (
        "Write adversarial cases: handoffs that look complete at a glance but are not, or "
        "that look wrong but are fine. Examples: a description that is only filler or "
        "whitespace, a due date one day past a dueNotAfter date, a label that differs only "
        "by case, a superseded decision, a decision whose scope does not actually match the "
        "item, sender and receiver being the same person."
    ),
}


def read_key(name: str) -> str:
    text = (KEY_DIR / name).read_text(encoding="utf-8").strip()
    # Tolerate "NAME=value" or a labelled line; the key is the last token.
    return text.split()[-1].split("=")[-1]


def call(cfg: dict, path: str, body: dict | None) -> dict:
    req = urllib.request.Request(
        cfg["baseUrl"] + path,
        data=json.dumps(body).encode() if body else None,
        headers={
            "Authorization": "Bearer " + read_key(cfg["keyFile"]),
            "Content-Type": "application/json",
        },
        method="POST" if body else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        # The response body is safe to show; the request headers are not.
        sys.exit(f"HTTP {e.code} from {cfg['baseUrl']}{path}: {e.read().decode(errors='replace')[:500]}")


def is_str_list(v) -> bool:
    return isinstance(v, list) and all(isinstance(x, str) for x in v)


def opt_str(v) -> bool:
    return v is None or isinstance(v, str)


def valid(s) -> bool:
    """Shape check mirroring src/rules/types.ts, so a malformed sample never reaches the measure set."""
    try:
        h, it = s["handoff"], s["handoff"]["item"]
        ok = (
            all(isinstance(it[k], str) for k in ("key", "projectKey", "summary", "description"))
            and is_str_list(it["labels"]) and is_str_list(it["components"])
            and opt_str(it["dueDate"]) and opt_str(it["assigneeId"])
            and opt_str(h["fromId"]) and opt_str(h["toId"]) and is_str_list(h["acknowledged"])
            and isinstance(s["decisions"], list)
        )
        for d in s["decisions"]:
            ok = ok and (
                isinstance(d["id"], str) and isinstance(d["title"], str)
                and d["status"] in ("decided", "superseded")
                and d["source"]["kind"] in ("confluence", "jira", "ledger")
                and isinstance(d["source"]["ref"], str)
                and d["scope"]["kind"] in ("project", "label", "workItem")
                and all(c["kind"] in ("dueNotAfter", "labelRequired", "componentForbidden") for c in d["constraints"])
            )
        return bool(ok)
    except (KeyError, TypeError):
        return False


def parse_array(text: str) -> list:
    start, end = text.find("["), text.rfind("]")
    if start < 0 or end < 0:
        return []
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", required=True, choices=["muse", "baseten"])
    ap.add_argument("--count", type=int, default=BATCH)
    ap.add_argument("--list-models", action="store_true")
    args = ap.parse_args()

    cfg = json.loads((ROOT / "scripts" / "models.json").read_text(encoding="utf-8"))[args.provider]

    if args.list_models:
        for m in call(cfg, "/models", None).get("data", []):
            print(m.get("id"))
        return

    if not cfg["model"]:
        sys.exit(f"Set the model for {args.provider} in scripts/models.json (try --list-models).")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    samples, rejected, tok_in, tok_out = [], 0, 0, 0
    while len(samples) < args.count:
        n = min(BATCH, args.count - len(samples))
        res = call(cfg, "/chat/completions", {
            "model": cfg["model"],
            "messages": [
                {"role": "system", "content": COMMON.replace("{n}", str(n))},
                {"role": "user", "content": STYLE[args.provider] + f" Today is {stamp[:4]}-{stamp[4:6]}-{stamp[6:8]}."},
            ],
        })
        usage = res.get("usage", {})
        tok_in += usage.get("prompt_tokens", 0)
        tok_out += usage.get("completion_tokens", 0)
        batch = parse_array(res["choices"][0]["message"]["content"] or "")
        good = [s for s in batch if valid(s)]
        rejected += len(batch) - len(good)
        if not good:
            # Stop rather than loop on a model that cannot follow the schema and burn credit.
            print("A batch produced no valid sample; stopping.")
            break
        samples += good[:n]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{args.provider}-{stamp}.json"
    out.write_text(json.dumps({
        "synthetic": True,
        "labeled": False,
        "provider": args.provider,
        "model": cfg["model"],
        "generatedAt": stamp,
        "samples": samples,
    }, indent=2), encoding="utf-8")

    cost = None
    if cfg["usdPerMTokIn"] is not None and cfg["usdPerMTokOut"] is not None:
        cost = round((tok_in * cfg["usdPerMTokIn"] + tok_out * cfg["usdPerMTokOut"]) / 1e6, 6)
    with (OUT_DIR / "cost.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "at": stamp, "provider": args.provider, "model": cfg["model"],
            "samples": len(samples), "rejected": rejected,
            "tokensIn": tok_in, "tokensOut": tok_out, "usd": cost,
        }) + "\n")
    print(f"{len(samples)} samples -> {out.relative_to(ROOT)}; rejected {rejected}; "
          f"tokens {tok_in}/{tok_out}; usd {cost}")


if __name__ == "__main__":
    main()
