#!/usr/bin/env python3
"""Root-owned workspace helper, run as the unprivileged agent via scoped sudo.

Receives no application/Core credentials. JSON stdin avoids shell interpolation.
This grants no filesystem access beyond the agent account's existing permissions.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def git(path, args, index=None, binary=False):
    env = {"PATH": os.defpath, "LANG": "C.UTF-8", "GIT_TERMINAL_PROMPT": "0",
           "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull}
    if index:
        env["GIT_INDEX_FILE"] = str(index)
    result = subprocess.run(["git", "-c", "core.hooksPath=/dev/null", "-C", path, *args],
                            capture_output=True, timeout=45, env=env)
    if result.returncode:
        raise ValueError("Git operation failed: " + result.stderr.decode(errors="replace")[-1000:].strip())
    return result.stdout if binary else result.stdout.decode(errors="replace").strip()


def run(value):
    path = value["path"]
    operation = value["op"]
    if operation == "git":
        return {"stdout": git(path, value["args"])}
    if operation == "inspect":
        folder, root = Path(path), Path(value["root"]).resolve(strict=True)
        if folder.is_symlink() or folder.resolve(strict=True).parent != root:
            raise ValueError("Task workspace is outside its configured root")
        return {"occupied": any(folder.iterdir())}
    if operation == "tree":
        with tempfile.TemporaryDirectory(prefix="agentroom-index-") as temporary:
            index = Path(temporary) / "index"
            git(path, ["read-tree", value["base"]], index)
            git(path, ["add", "-A", "--", "."], index)
            return {"tree": git(path, ["write-tree"], index)}
    if operation == "patch":
        raw = git(path, ["diff", "--binary", "--no-ext-diff", "--no-textconv", value["base"], value["tree"]], binary=True)
        if len(raw) > 20 * 1024 * 1024:
            raise ValueError("Patch exceeds the 20 MiB review limit")
        return {"patch": base64.b64encode(raw).decode()}
    raise ValueError("Unknown workspace operation")


if __name__ == "__main__":
    try:
        print(json.dumps(run(json.loads(sys.stdin.read(100000)))))
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
