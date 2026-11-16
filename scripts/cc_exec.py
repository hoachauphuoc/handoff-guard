"""Dev-only: run one brief through Command Code (headless) in its own git worktree.

A headless Command Code run is refused every file edit unless it runs with --yolo (trial of 2026-11-16), so
this launcher always pairs --yolo with a new worktree (-w): the run can touch only that copy, and Claude
reads its diff before anything reaches the main checkout. The brief says what must not be done (commit,
push, deploy, the key folder); this script adds nothing to it. Standard library only.

  python scripts/cc_exec.py --brief brief.md --name <worktree> [--model <id>] [--max-turns 40] [--timeout 900]
"""
import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import time

# A cheap default; any id from `commandcode --list-models` can be passed instead.
DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash"
REPO = pathlib.Path(__file__).resolve().parent.parent


def worktree_of(name: str) -> pathlib.Path | None:
    # Command Code keeps its worktrees outside the repo; git knows where, by the folder name.
    out = subprocess.run(["git", "-C", str(REPO), "worktree", "list", "--porcelain"], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if line.startswith("worktree ") and pathlib.Path(line[9:]).name == name:
            return pathlib.Path(line[9:])
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--brief", required=True)
    ap.add_argument("--name", required=True, help="worktree name; the same name continues in the same worktree")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--max-turns", type=int, default=40)
    ap.add_argument("--timeout", type=int, default=900, help="seconds before Command Code is stopped")
    a = ap.parse_args()
    cc = shutil.which("commandcode")
    if cc is None:
        sys.exit("Command Code (`commandcode`) is not on PATH.")
    brief = pathlib.Path(a.brief).read_text(encoding="utf-8")
    cmd = [cc, "-p", brief, "-w", a.name, "--yolo", "--max-turns", str(a.max_turns), "-m", a.model, "--output-format", "json"]
    started = time.time()
    proc = subprocess.Popen(cmd, cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    try:
        out, err = proc.communicate(timeout=a.timeout)
        code = proc.returncode
    except subprocess.TimeoutExpired:
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
        out, err = proc.communicate()
        code = 124
    # The event stream is long; only the final result line says how the run ended.
    result: dict = {}
    for line in (out or "").splitlines():
        if line.startswith("{") and '"type":"result"' in line:
            try:
                result = json.loads(line)
            except json.JSONDecodeError:
                pass
    print(f"stop: {result.get('stopReason', 'unknown')}")
    print(f"last words: {str(result.get('finalText', '')).strip()[:1500]}")
    tree = worktree_of(a.name)
    if tree is None:
        print(f"worktree {a.name}: not found")
    else:
        status = subprocess.run(["git", "-C", str(tree), "status", "--short"], capture_output=True, text=True).stdout
        print(f"worktree: {tree}\n{status or '(no changes)'}")
    if err:
        sys.stderr.write(err[-3000:])
    print(f"\ncommandcode: exit {code}{' (timed out)' if code == 124 else ''}, {time.time() - started:.0f}s, model {a.model}", file=sys.stderr)
    sys.exit(code)


if __name__ == "__main__":
    main()
