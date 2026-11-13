"""Dev-only: run one brief through Muse Code (headless) with a Muse model as the executor.

Muse Code has its own tools: it reads, edits and runs commands inside --workspace. The key goes to it on
stdin, so it is never an argument, and it is masked in whatever Muse Code prints. Standard library only.

  python scripts/muse_exec.py --brief brief.md --workspace <folder> [--max-steps 40] [--timeout 900] [--worktree]
"""
import argparse
import pathlib
import shutil
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from research_score import RUNNERS, read_key  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--brief", required=True)
    ap.add_argument("--workspace", required=True)
    ap.add_argument("--max-steps", type=int, default=40)
    ap.add_argument("--timeout", type=int, default=900, help="seconds before Muse Code is stopped")
    ap.add_argument("--worktree", action="store_true", help="let Muse Code work in a new git worktree of the workspace")
    ap.add_argument("--runner", default="muse", help="a key of scripts/models.json")
    a = ap.parse_args()
    cfg = RUNNERS[a.runner]
    muse = shutil.which("muse")
    if muse is None:
        sys.exit("Muse Code (`muse`) is not on PATH.")
    key = read_key(cfg["keyFile"])
    cmd = [muse, "exec", "--api-key-stdin", "--model", cfg["model"], "--workspace", str(pathlib.Path(a.workspace).resolve()),
           "--prompt-file", str(pathlib.Path(a.brief).resolve()), "--max-model-steps", str(a.max_steps)]
    if a.worktree:
        cmd += ["--worktree", "create"]
    started = time.time()
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            text=True, encoding="utf-8", errors="replace")
    try:
        out, err = proc.communicate(key + "\n", timeout=a.timeout)
        code = proc.returncode
    except subprocess.TimeoutExpired:
        # Muse Code has been seen to finish the work and then not exit; killing the tree releases the pipes.
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
        out, err = proc.communicate()
        code = 124
    for stream, text in ((sys.stdout, out), (sys.stderr, err)):
        stream.write((text or "").replace(key, "<key>"))
    print(f"\nmuse exec: exit {code}{' (timed out)' if code == 124 else ''}, {time.time() - started:.0f}s, model {cfg['model']}", file=sys.stderr)
    sys.exit(code)


if __name__ == "__main__":
    main()
