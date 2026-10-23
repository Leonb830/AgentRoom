import json
import subprocess
from pathlib import Path
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
import app

THREAD = "b751fbab-a622-42a6-a6bb-68afd5a44918"


@pytest.fixture
def project(tmp_path, monkeypatch):
    repo = tmp_path / "repository"
    repo.mkdir()
    subprocess.run(["git", "init", "-b", "main", str(repo)], check=True, capture_output=True)
    (repo / "one.txt").write_text("before\n")
    app.git(repo, "add", ".")
    app.git(repo, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "baseline")
    base = app.git(repo, "rev-parse", "HEAD")
    workspaces = tmp_path / "workspaces"
    workspaces.mkdir()
    worktree = workspaces / THREAD
    app.git(repo, "worktree", "add", "-b", "agentroom/" + THREAD, str(worktree), base)
    monkeypatch.setattr(app, "settings", app.Settings(_env_file=None, execution_token="test-only-token", agentroom_repository=repo,
                        agentroom_workspaces=workspaces, agentroom_snapshots=tmp_path / "snapshots"))
    app.write_json(app.binding_path(THREAD), {"base": base, "branch": "agentroom/" + THREAD, "path": str(worktree)})
    return repo, worktree, base


def test_every_execution_route_requires_service_auth(monkeypatch):
    monkeypatch.setattr(app, "settings", app.Settings(_env_file=None, execution_token="test-only-token"))
    client = TestClient(app.app)
    for route in ["/health", f"/threads/{THREAD}/state", f"/threads/{THREAD}/events", f"/threads/{THREAD}/patch/" + "a"*40]:
        assert client.get(route).status_code == 401
    assert client.post(f"/threads/{THREAD}/start").status_code == 401


def test_review_includes_untracked_files_without_touching_user_index(project, monkeypatch):
    repo, worktree, base = project
    monkeypatch.setattr(app, "state", lambda _: {"state": "idle", "queue": []})
    (worktree / "one.txt").write_text("after\n")
    (worktree / "new.txt").write_text("new file\n")
    before = app.git(worktree, "diff", "--cached")
    result = app.review(THREAD)
    assert "+after" in result["patch"] and "+new file" in result["patch"]
    assert app.git(worktree, "diff", "--cached") == before
    assert (repo / "one.txt").read_text() == "before\n"
    exported = app.export_patch(THREAD, result["snapshot"]).body
    (worktree / "one.txt").write_text("later\n")
    assert app.export_patch(THREAD, result["snapshot"]).body == exported
    assert result["tests"] is None


def test_capture_rejects_running_or_queued_work(project, monkeypatch):
    for state in [{"state": "running", "current_request": "active"}, {"state": "idle", "queue": ["queued"]}]:
        monkeypatch.setattr(app, "state", lambda _: state)
        with pytest.raises(HTTPException) as error:
            app.review(THREAD)
        assert error.value.status_code == 409


def test_export_detects_tampering(project, monkeypatch):
    monkeypatch.setattr(app, "state", lambda _: {"state": "idle"})
    result = app.review(THREAD)
    (app.binding_path(THREAD).parent / (result["snapshot"] + ".patch")).write_bytes(b"tampered")
    with pytest.raises(HTTPException) as error:
        app.export_patch(THREAD, result["snapshot"])
    assert error.value.status_code == 409


def test_stop_pauses_before_interrupt_and_reuses_identity(monkeypatch):
    calls = []
    monkeypatch.setattr(app, "core", lambda method, path, body=None: calls.append((path, body)) or {})
    monkeypatch.setattr(app, "state", lambda _: {"state": "running", "queue_paused": True, "current_request": "turn-a"})
    app.stop(THREAD, THREAD)
    first = list(calls)
    app.stop(THREAD, THREAD)
    assert first[0][0].endswith("/stop") and first[1][0].endswith("/interrupt")
    assert first[1][1]["target_request_id"] == "turn-a"
    assert first == calls[2:]


def test_invalid_identity_cannot_escape_snapshot_root():
    with pytest.raises(HTTPException):
        app.binding_path("../../etc")


def test_core_readiness_does_not_imply_harness_authentication(project, monkeypatch):
    def response(method, path, body=None):
        return {"/v1/ready": {"ready": True}, "/v1/capabilities": {}, "/v1/accounts/codex": {"state": "missing"}}[path]
    monkeypatch.setattr(app, "core", response)
    result = app.health()
    assert result["coreReady"] is True
    assert result["ready"] is False
    assert result["message"] == "Codex sign-in required"
