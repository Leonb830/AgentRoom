#!/usr/bin/env python3
"""Exercise FastAPI against real pinned Core with upstream's simulated harness."""
import argparse
import shutil
import sys
import time
import uuid
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(root / "backend"), str(args.source.resolve() / "tests")]
from core_fixture import ReplayTests
import app

fixture = ReplayTests()
fixture.setUp()
try:
    node_directory = Path(fixture.env["CLOUDROOM_ACCOUNT_HOME"]) / ".local/bin"
    node_directory.mkdir(parents=True)
    (node_directory / "node").symlink_to(shutil.which("node"))
    app.git(fixture.repo, "symbolic-ref", "HEAD", "refs/heads/main")
    (fixture.repo / "hello.txt").write_text("before\n")
    app.git(fixture.repo, "add", ".")
    app.git(fixture.repo, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "baseline")
    fixture.start()
    app.settings = app.Settings(_env_file=None, cloudroom_url="http://" + fixture.service.address,
        cloudroom_token=fixture.env["CLOUDROOM_TOKEN"], execution_token="test-token",
        agentroom_repository=fixture.repo, agentroom_workspaces=fixture.state / "code",
        agentroom_snapshots=fixture.root / "snapshots")
    thread_id = str(uuid.uuid4())
    started = app.start(thread_id)
    assert started == app.start(thread_id), "Start retry changed workspace identity"
    request_id = str(uuid.uuid4())
    prompt = app.Command(id=request_id, kind="prompt", text="reply-first")
    app.command(thread_id, prompt)
    app.command(thread_id, prompt)
    for _ in range(100):
        current = app.state(thread_id)
        if current["receipts"][request_id]["state"] == "completed":
            break
        time.sleep(.1)
    else:
        raise AssertionError("Fixture prompt did not finish")
    records = app.events(thread_id)["events"]
    assert records and len({item["sequence"] for item in records}) == len(records)
    app.command(thread_id, app.Command(id=str(uuid.uuid4()), kind="stop"))
    assert app.state(thread_id)["queue_paused"]
    app.command(thread_id, app.Command(id=str(uuid.uuid4()), kind="resume"))
    path = app.workspace(thread_id)
    (path / "hello.txt").write_text("after\n")
    review = app.review(thread_id)
    assert "+after" in review["patch"]
    assert app.export_patch(thread_id, review["snapshot"]).body
    assert (fixture.repo / "hello.txt").read_text() == "before\n"
    print("PASS: Core-backed adapter start/retry, prompt/retry, replay, stop/resume, worktree, snapshot, and patch export.")
    print("Harness and code modification were fixtures. No real inference or production isolation was tested.")
finally:
    fixture.tearDown()
