#!/usr/bin/env python3
"""Fetch and build pinned Core; install a separate pinned Codex without global changes."""
import hashlib
import json
import shutil
import subprocess
import tarfile
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
lock = json.loads((root / "runtime.lock.json").read_text())
directory = root / ".runtime"
directory.mkdir(exist_ok=True, mode=0o700)
if not shutil.which("cargo") or not shutil.which("npm") or not shutil.which("node"):
    raise SystemExit("Install Rust >=1.89, Node.js 24, and npm first; see docs/SETUP.md.")
archive = directory / "core.tar.gz"
if not archive.exists():
    with urllib.request.urlopen("https://codeload.github.com/davidondrej/cloudroom-core/tar.gz/" + lock["coreCommit"], timeout=60) as response:
        archive.write_bytes(response.read())
if hashlib.sha256(archive.read_bytes()).hexdigest() != lock["sourceArchiveSha256"]:
    raise SystemExit("Pinned source checksum mismatch; refusing to extract or build")
source = directory / ("cloudroom-core-" + lock["coreCommit"])
if not source.exists():
    with tarfile.open(archive) as tar:
        tar.extractall(directory, filter="data")
subprocess.run(["cargo", "build", "--locked", "--jobs", "2"], cwd=source, check=True)
subprocess.run(["npm", "install", "--prefix", str(directory / "harness"), "--cache", str(directory / "npm-cache"), lock["codexPackage"], "--no-audit", "--no-fund"], check=True)
print("Pinned binaries prepared. No login or system-service installation was performed.")
print("Core:", source / "target/debug/cloudroom")
print("Codex:", directory / "harness/node_modules/.bin/codex")
