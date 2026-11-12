"""Dev-only: generate UNLABELED synthetic handoff samples for the measure set.

Models propose samples; labels come from the rules or the owner, never from a model.
Standard library only, so the repo gains no dependency for a dev script.

  python scripts/gen_samples.py --count 30
  python scripts/gen_samples.py --validate data/samples/sonnet-adversarial.json

Adversarial samples are written by Claude Sonnet in the CLI, not by this script;
--validate applies the same shape check to those files.
"""
import argparse
import concurrent.futures
import json
import time
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
      | {"kind": "labelForbidden", "label": string}
      | {"kind": "componentRequired", "component": string}
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

STYLE = (
    "Vary the writing voice across samples: terse engineer, careful project manager, "
    "rushed support agent, new joiner. Mix clean handoffs with ones missing a receiver, "
    "a description, a due date, or an acknowledgement, and ones that break a decision."
)


def read_key(name: str) -> str:
    text = (KEY_DIR / name).read_text(encoding="utf-8").strip()
    # Tolerate "NAME=value" or a labelled line; the key is the last token.
    return text.split()[-1].split("=")[-1]


def call(cfg: dict, path: str, body: dict) -> dict:
    req = urllib.request.Request(
        cfg["baseUrl"] + path,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": "Bearer " + read_key(cfg["keyFile"]),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        # The response body is safe to show; the request headers are not.
        raise RuntimeError(f"HTTP {e.code} on {path}: {e.read().decode(errors='replace')[:500]}") from None
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error on {path}: {e.reason}") from None


def one_batch(cfg: dict, n: int, today: str) -> tuple[list, int, int, int]:
    """One request for n samples. Returns (valid samples, rejected, tokens in, tokens out)."""
    res = call(cfg, "/chat/completions", {
        "model": cfg["model"],
        "messages": [
            {"role": "system", "content": COMMON.replace("{n}", str(n))},
            {"role": "user", "content": STYLE + f" Today is {today}."},
        ],
    })
    usage = res.get("usage") or {}
    batch = parse_array(res["choices"][0]["message"]["content"] or "")
    good = [s for s in batch if valid(s)]
    return good[:n], len(batch) - len(good), usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)


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
                and all(c["kind"] in ("dueNotAfter", "labelRequired", "labelForbidden", "componentRequired", "componentForbidden") for c in d["constraints"])
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
    ap.add_argument("--count", type=int, default=BATCH)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--validate", metavar="FILE", help="shape-check an existing sample file and exit")
    args = ap.parse_args()

    if args.validate:
        data = json.loads(pathlib.Path(args.validate).read_text(encoding="utf-8"))
        bad = [i for i, s in enumerate(data["samples"]) if not valid(s)]
        print(f"{len(data['samples'])} samples, invalid indexes: {bad}")
        sys.exit(1 if bad or data.get("labeled") is not False or data.get("synthetic") is not True else 0)

    provider = "muse"
    cfg = json.loads((ROOT / "scripts" / "models.json").read_text(encoding="utf-8"))[provider]

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    today = f"{stamp[:4]}-{stamp[4:6]}-{stamp[6:8]}"
    sizes = [BATCH] * (args.count // BATCH) + ([args.count % BATCH] if args.count % BATCH else [])
    samples, rejected, tok_in, tok_out, failed = [], 0, 0, 0, 0
    started = time.monotonic()
    # One round only; a shortfall is reported, not retried, so a failing model cannot burn credit.
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for fut in concurrent.futures.as_completed(
            [pool.submit(one_batch, cfg, n, today) for n in sizes]
        ):
            try:
                good, rej, ti, to = fut.result()
            except (RuntimeError, KeyError, IndexError, TypeError) as e:
                failed += 1
                print(f"batch failed: {e}")
                continue
            samples += good
            rejected += rej
            tok_in += ti
            tok_out += to
    seconds = round(time.monotonic() - started, 1)
    if not samples:
        sys.exit("No valid sample produced.")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{provider}-{stamp}.json"
    out.write_text(json.dumps({
        "synthetic": True,
        "labeled": False,
        "provider": provider,
        "model": cfg["model"],
        "generatedAt": stamp,
        "samples": samples,
    }, indent=2), encoding="utf-8")

    cost = None
    if cfg["usdPerMTokIn"] is not None and cfg["usdPerMTokOut"] is not None:
        cost = round((tok_in * cfg["usdPerMTokIn"] + tok_out * cfg["usdPerMTokOut"]) / 1e6, 6)
    with (OUT_DIR / "cost.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "at": stamp, "provider": provider, "model": cfg["model"],
            "samples": len(samples), "rejected": rejected,
            "tokensIn": tok_in, "tokensOut": tok_out, "usd": cost, "seconds": seconds,
        }) + "\n")
    print(f"{len(samples)}/{args.count} samples -> {out.relative_to(ROOT)}; rejected {rejected}; "
          f"failed batches {failed}; tokens {tok_in}/{tok_out}; usd {cost}; {seconds}s")


if __name__ == "__main__":
    main()
