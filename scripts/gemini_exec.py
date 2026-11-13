"""Dev-only: the Gemini runner executes one brief and this script writes the files it returns.

Gemini has no tools here: it is sent the brief and the named files, and answers with whole files.
Only paths named with --edit or --new are written; anything else in the answer is refused.
Standard library only.

  python scripts/gemini_exec.py --brief brief.md --edit src/a.ts --edit tests/a.test.ts --new docs/X.md --read src/b.ts
  python scripts/gemini_exec.py --brief fix.md --edit src/a.ts --feedback check-output.txt   (send a failed check back)
"""
import argparse
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from research_score import ROOT, RUNNERS, muse  # noqa: E402

SYSTEM = """You are the implementer on a software project. You are given a brief and the current content of some files.
Do exactly what the brief asks and nothing else. You cannot run commands or read other files.
Answer with every file you change or create, each one WHOLE (never a diff, never an excerpt), in this exact form:

=== FILE: relative/path ===
<the complete new content of the file>
=== END FILE ===

After the last file, write a section starting with the line "=== NOTES ===" that says in a few lines what you did,
what you could not do, and what you are unsure about. Do not wrap file contents in code fences.
You may only write the files listed as editable or new. Follow the project rules given in the brief."""

BLOCK = re.compile(r"^=== FILE: (.+?) ===\r?\n(.*?)\r?\n=== END FILE ===[ \t]*\r?$", re.S | re.M)


def parse_answer(answer: str, allowed: set[str], norm) -> tuple[list[tuple[str, str]], str, list[str]]:
    blocks = [(norm(rel.strip()), body) for rel, body in BLOCK.findall(answer)]
    notes = answer.split("=== NOTES ===", 1)[1].strip() if "=== NOTES ===" in answer else "(no notes section)"
    refused = [rel for rel, _ in blocks if rel not in allowed]
    return blocks, notes, refused


def inside(root: pathlib.Path, rel: str) -> pathlib.Path:
    path = (root / rel).resolve()
    if root != path and root not in path.parents:
        sys.exit(f"Refused: {rel} is outside {root}")
    return path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--brief", required=True)
    ap.add_argument("--edit", action="append", default=[], help="existing file Gemini may rewrite (repeatable)")
    ap.add_argument("--new", action="append", default=[], help="file Gemini may create (repeatable)")
    ap.add_argument("--read", action="append", default=[], help="file sent for context only (repeatable)")
    ap.add_argument("--feedback", help="file with a failed check's output, sent back for a rework")
    ap.add_argument("--root", default=str(ROOT), help="folder the paths are relative to (default: the repo)")
    ap.add_argument("--runner", default="gemini", help="a key of scripts/models.json")
    ap.add_argument("--dry-run", action="store_true", help="print the answer, write nothing")
    a = ap.parse_args()
    root = pathlib.Path(a.root).resolve()
    cfg = RUNNERS[a.runner]
    norm = lambda rel: inside(root, rel).relative_to(root).as_posix()  # noqa: E731
    allowed = {norm(p) for p in a.edit + a.new}

    def shown(label: str, rels: list) -> str:
        return "".join(f"\n----- {label}: {norm(r)} -----\n{inside(root, r).read_text(encoding='utf-8')}\n" for r in rels)

    user = (
        pathlib.Path(a.brief).read_text(encoding="utf-8")
        + f"\n\nEditable files: {sorted(norm(p) for p in a.edit)}\nNew files you may create: {sorted(norm(p) for p in a.new)}\n"
        + shown("EDITABLE", a.edit) + shown("READ ONLY", a.read)
        + (f"\n----- A CHECK FAILED ON YOUR LAST ANSWER; fix it -----\n{pathlib.Path(a.feedback).read_text(encoding='utf-8')}\n" if a.feedback else "")
    )
    answer = muse(cfg["model"], SYSTEM, user, cfg)
    blocks, notes, refused = parse_answer(answer, allowed, norm)
    if not blocks:
        sys.stdout.buffer.write(answer.encode("utf-8"))
        sys.exit("\nNo file blocks in the answer; nothing written.")
    if refused:
        sys.exit(f"Refused, nothing written: the answer names files outside --edit/--new: {refused}")
    for rel, body in blocks:
        if not a.dry_run:
            path = inside(root, rel)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(body.replace("\r\n", "\n") + "\n", encoding="utf-8", newline="")
        print(f"{'would write' if a.dry_run else 'wrote'} {rel} ({len(body.splitlines())} lines)")
    sys.stdout.buffer.write(f"by {cfg['model']}\n--- notes ---\n{notes}\n".encode("utf-8"))


if __name__ == "__main__":
    main()
