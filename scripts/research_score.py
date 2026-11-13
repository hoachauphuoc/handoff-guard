"""Dev-only: Muse plans web searches, Tavily runs them, Muse writes what could raise each judging score.

Research only; nothing it writes reaches the product. Standard library only.

  python scripts/research_score.py models
  python scripts/research_score.py run --model muse-spark-1.3-contributor --out <path>
"""
import argparse
import concurrent.futures
import json
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
KEY_DIR = pathlib.Path.home() / ".bjt"
CFG = json.loads((ROOT / "scripts" / "models.json").read_text(encoding="utf-8"))["muse"]

BRIEF = """Product: Handoff Guard, a Forge app for Jira (Codegeist 2026 entry, solo).
When a Jira work item is reassigned, plain-code rules check what the receiver is missing (description, due date,
receiver, acknowledgement) and which recorded team decisions bind the item (required/forbidden labels and
components, latest due date). Built so far:
- Issue panel with a verdict (Clear / Needs attention / Blocked), an I-PASS style action list with owners, suggested fixes.
- Teach-back: the receiver writes one read-back; plain code refuses it if it contradicts a decision (later date,
  skipping a required label, adding a forbidden one). Forge LLMs (Claude Haiku) writes one labelled sentence beside the refusal; it never decides.
- Workflow validator that blocks a transition until the handoff is Clear.
- Drift: an acknowledgement goes stale when the due date, labels or components change after it.
- Decisions ledger page (Forge storage) with replay and supersede; Rovo agent actions (explain, find decisions with confirm);
  Teamwork Graph saved queries to suggest people with context. Jira-only, Runs on Atlassian eligible.
- Measured on 48 synthetic samples: 47/48 agreement with model-written labels (not accuracy).
Weak spots known: no real users or testimonials; demo video not filmed yet; second-account install not yet tested.
Current self-estimated scores out of 10: Tech 8, Design 8, Impact 9 (uncertain), Innovation 8, Presentation 6."""

CRITERIA = """Codegeist 2026 judging, 20% each:
1 Technological Implementation: thorough, skilful use of Forge and at least one Atlassian product/capability; non-trivial and working.
2 Design: complete, coherent product experience, not a proof of concept.
3 Potential Impact: credible, specific case for a real problem and audience, and the demo shows the solution addresses it.
4 Innovation/Idea: creative, novel, differs from existing concepts.
5 Presentation: video shows it working end to end; pitch says problem, audience, why it matters; easy to follow."""


def read_key(name: str) -> str:
    text = (KEY_DIR / name).read_text(encoding="utf-8").strip()
    return text.split()[-1].split("=")[-1]


def http(url: str, body: dict | None, key: str, timeout: int = 300) -> dict:
    req = urllib.request.Request(
        url,
        data=None if body is None else json.dumps(body).encode(),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        method="GET" if body is None else "POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        # The response body is safe to show; the request headers are not.
        raise RuntimeError(f"HTTP {e.code} on {url}: {e.read().decode(errors='replace')[:400]}") from None


def muse(model: str, system: str, user: str) -> str:
    out = http(CFG["baseUrl"] + "/chat/completions", {
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }, read_key(CFG["keyFile"]))
    content = out["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = " ".join(p.get("text", "") for p in content if isinstance(p, dict))
    return content


def tavily(query: str) -> dict:
    out = http("https://api.tavily.com/search", {
        "query": query, "search_depth": "advanced", "max_results": 5, "include_answer": True,
    }, read_key("tavily_api_key.txt"), timeout=120)
    return {
        "query": query,
        "answer": out.get("answer"),
        "results": [{"title": r.get("title"), "url": r.get("url"), "content": (r.get("content") or "")[:700]} for r in out.get("results", [])],
    }


def parse_list(text: str) -> list:
    start, end = text.find("["), text.rfind("]")
    return json.loads(text[start:end + 1])


def run(model: str, out_path: pathlib.Path, n: int) -> None:
    plan = muse(model, "You are a hackathon strategy researcher. Answer with JSON only.",
        f"{BRIEF}\n\n{CRITERIA}\n\nPlan {n} web searches that would find evidence for raising each score toward 10: "
        "what past Codegeist and other Atlassian hackathon winners did (videos, judging comments), Forge features judges reward "
        "(Rovo agents, Forge LLMs, Teamwork Graph, Runs on Atlassian, automation, dashboards), evidence that handoff/reassignment "
        "loss is a real costly problem (studies, statistics), competing Marketplace apps, and demo-video best practice. "
        'Return a JSON array of objects {"criterion": 1-5, "query": string}.')
    queries = parse_list(plan)[:n]
    print(f"{len(queries)} queries planned", file=sys.stderr)
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        found = list(pool.map(lambda q: {**tavily(q["query"]), "criterion": q.get("criterion")}, queries))
    report = muse(model,
        "You are a blunt hackathon judge and strategist. Use only the search results given; cite URLs. Mark anything "
        "not supported by a result as 'unverified'. Write plain English, no hype.",
        f"{BRIEF}\n\n{CRITERIA}\n\nSearch results (JSON):\n{json.dumps(found, ensure_ascii=False)}\n\n"
        "For each of the 5 criteria: (a) what likely caps the score now, (b) the 3 highest-value changes that fit "
        "in about 5 weeks for one person with 1-2 hours a day, each with the evidence URL, (c) what a 10 would look like. "
        "Then a ranked top-5 list across all criteria by expected points gained per hour.")
    out_path.write_text(json.dumps({"model": model, "queries": queries, "results": found, "report": report}, ensure_ascii=False, indent=1), encoding="utf-8", newline="")
    print(report)


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("models")
    r = sub.add_parser("run")
    r.add_argument("--model", default=CFG["model"])
    r.add_argument("--out", required=True)
    r.add_argument("--queries", type=int, default=16)
    a = ap.parse_args()
    if a.cmd == "models":
        print([m.get("id") for m in http(CFG["baseUrl"] + "/models", None, read_key(CFG["keyFile"]), 60).get("data", [])])
    else:
        run(a.model, pathlib.Path(a.out), a.queries)


if __name__ == "__main__":
    main()
