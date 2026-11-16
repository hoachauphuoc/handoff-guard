"""Dev-only: run one brief through Command Code (headless) in its own git worktree.

A headless Command Code run is refused every file edit unless it runs with --yolo, and with --yolo its own
-w flag made no worktree: the trial of 2026-11-16 wrote into the main checkout. So this launcher makes the
worktree itself with git, outside the repo, and starts Command Code inside it; Claude reads its diff before
anything reaches the main checkout. A new worktree is not yet trusted by Command Code, which then ignores --yolo, so -t
trusts it. The brief says what must not be done (commit,
push, deploy, the key folder); this script adds nothing to it. Standard library only.

  python scripts/cc_exec.py --brief brief.md --name <worktree> [--max-turns 40] [--timeout 900] [--model <open model>]
"""
import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import time

REPO = pathlib.Path(__file__).resolve().parent.parent
# The owner's rule: runners use only Muse Spark contributor, and its id comes only from scripts/models.json.
# Command Code names the same model under its maker.
MODEL = "meta/" + json.loads((REPO / "scripts" / "models.json").read_text(encoding="utf-8"))["muse"]["model"]


# The owner ordered open models for code review on 2026-11-16; only these ids are accepted through --model,
# so the Muse-only rule still holds for every other run.
OPEN_MODELS = {"deepseek/deepseek-v4-pro", "moonshotai/kimi-k3.1-pro", "zai-org/glm-5.3", "qwen/qwen3.8-max"}

TREES = REPO.parent / "cc-worktrees"


def worktree(name: str) -> pathlib.Path:
    """The run's own checkout of main on branch runner/<name>; an existing one is reused for a rework round."""
    tree = TREES / name
    if not tree.exists():
        made = subprocess.run(["git", "-C", str(REPO), "worktree", "add", "-b", f"runner/{name}", str(tree), "HEAD"], capture_output=True, text=True)
        if made.returncode != 0:
            sys.exit(f"could not make the worktree: {made.stderr.strip()}")
    return tree


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--brief", required=True)
    ap.add_argument("--name", required=True, help="worktree name; the same name continues in the same worktree")
    ap.add_argument("--max-turns", type=int, default=40)
    ap.add_argument("--timeout", type=int, default=900, help="seconds before Command Code is stopped")
    ap.add_argument("--model", choices=sorted(OPEN_MODELS), help="an open model, for a review brief; default is Muse Spark contributor")
    a = ap.parse_args()
    model = a.model or MODEL
    cc = shutil.which("commandcode")
    if cc is None:
        sys.exit("Command Code (`commandcode`) is not on PATH.")
    brief = pathlib.Path(a.brief).read_text(encoding="utf-8")
    tree = worktree(a.name)
    # On Windows `commandcode` is an npm .cmd shim, and cmd.exe ends the command line at the brief's first line
    # break, dropping every flag after it. So the flags come first and the brief goes on stdin.
    cmd = [cc, "-t", "--yolo", "--max-turns", str(a.max_turns), "-m", model, "--output-format", "json", "-p"]
    started = time.time()
    proc = subprocess.Popen(cmd, cwd=tree, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    try:
        out, err = proc.communicate(brief, timeout=a.timeout)
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
    status = subprocess.run(["git", "-C", str(tree), "status", "--short"], capture_output=True, text=True).stdout
    print(f"worktree: {tree}\n{status or '(no changes)'}")
    # A run must never touch the main checkout; say so plainly if it did.
    main = subprocess.run(["git", "-C", str(REPO), "status", "--short"], capture_output=True, text=True).stdout
    print(f"main checkout now:\n{main or '(clean)'}")
    if not result:
        print("raw tail:\n" + "\n".join((out or "").splitlines()[-5:])[-2000:])
    if err:
        sys.stderr.write(err[-3000:])
    print(f"\ncommandcode: exit {code}{' (timed out)' if code == 124 else ''}, {time.time() - started:.0f}s, model {model}", file=sys.stderr)
    sys.exit(code)


if __name__ == "__main__":
    main()
