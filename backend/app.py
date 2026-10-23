"""Private execution adapter. Run one worker; never expose this port publicly."""
from __future__ import annotations

import hashlib
import base64
import json
import os
import re
import secrets
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Annotated, Literal

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    execution_token: str = ""
    cloudroom_url: str = "http://127.0.0.1:9840"
    cloudroom_token: str = ""
    agentroom_repository: Path = Path("/code/fixture")
    agentroom_workspaces: Path = Path("/code")
    agentroom_snapshots: Path = Path("/var/lib/agentroom/snapshots")
    agentroom_baseline: str = "main"
    agentroom_workspace_command: list[str] = []


settings = Settings()
app = FastAPI(title="AgentRoom private execution API", docs_url=None, redoc_url=None, openapi_url=None)
mutation_lock = threading.RLock()
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
HASH = re.compile(r"^[0-9a-f]{40,64}$")
IDLE = {"idle", "sleeping", "closed", "failed", "process_lost"}


def authorize(authorization: Annotated[str | None, Header()] = None):
    if not settings.execution_token:
        raise HTTPException(503, "Execution service is not configured")
    if not secrets.compare_digest(authorization or "", f"Bearer {settings.execution_token}"):
        raise HTTPException(401, "Unauthorized")


def core(method: str, path: str, body: dict | None = None):
    if not settings.cloudroom_token:
        raise HTTPException(503, "Core token is not configured")
    try:
        with httpx.Client(timeout=15, trust_env=False) as client:
            response = client.request(method, settings.cloudroom_url.rstrip("/") + path,
                                      headers={"Authorization": f"Bearer {settings.cloudroom_token}"}, json=body)
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Core is unreachable; an attempted command may need reconciliation") from exc
    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(502, "Core returned an invalid response") from exc
    if response.is_error:
        raise HTTPException(response.status_code, data.get("error", "Core rejected the request"))
    return data


def validate_id(thread_id: str):
    if not UUID.fullmatch(thread_id):
        raise HTTPException(422, "Invalid thread identity")


def sid(thread_id: str):
    validate_id(thread_id)
    return "cr_" + thread_id


def worker(operation: str, path: Path, **values) -> dict:
    command = settings.agentroom_workspace_command or [sys.executable, str(Path(__file__).with_name("workspace_worker.py"))]
    try:
        result = subprocess.run(command, input=json.dumps({"op": operation, "path": str(path), **values}),
                                capture_output=True, text=True, timeout=60,
                                env={"PATH": os.defpath, "LANG": "C.UTF-8"})
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(503, "Workspace operation timed out") from exc
    try:
        response = json.loads(result.stdout)
    except ValueError as exc:
        raise HTTPException(503, "Workspace helper is unavailable; check its service account permissions") from exc
    if result.returncode or "error" in response:
        raise HTTPException(409, response.get("error", "Workspace operation failed"))
    return response


def git(path: Path, *args: str) -> str:
    return worker("git", path, args=list(args))["stdout"]


def binding_path(thread_id: str) -> Path:
    validate_id(thread_id)
    return settings.agentroom_snapshots / thread_id / "binding.json"


def write_json(path: Path, value: dict):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_suffix(".tmp")
    with temporary.open("w") as file:
        json.dump(value, file)
        file.flush()
        os.fsync(file.fileno())
    temporary.replace(path)
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def binding(thread_id: str) -> dict:
    try:
        return json.loads(binding_path(thread_id).read_text())
    except FileNotFoundError as exc:
        raise HTTPException(404, "Task workspace has not been prepared") from exc


def workspace(thread_id: str) -> Path:
    info = binding(thread_id)
    if not info.get("path"):
        raise HTTPException(409, "Task workspace is still being prepared")
    path = Path(info["path"])
    worker("inspect", path, root=str(settings.agentroom_workspaces))
    expected = git(settings.agentroom_repository, "rev-parse", "--path-format=absolute", "--git-common-dir")
    if git(path, "rev-parse", "--path-format=absolute", "--git-common-dir") != expected:
        raise HTTPException(409, "Task repository identity has changed")
    return path


def state(thread_id: str):
    return core("GET", f"/v1/sessions/{sid(thread_id)}")["session"]


def assert_idle(thread_id: str):
    current = state(thread_id)
    if current["state"] not in IDLE or current.get("current_request") or current.get("queue"):
        raise HTTPException(409, "Wait for execution and queued work to settle before capturing changes")
    return current


@app.get("/health", dependencies=[Depends(authorize)])
def health():
    readiness = core("GET", "/v1/ready")
    capabilities = core("GET", "/v1/capabilities")
    account = core("GET", "/v1/accounts/codex")
    git(settings.agentroom_repository, "rev-parse", "--verify", settings.agentroom_baseline + "^{commit}")
    message = {"connected": "Runner connected", "missing": "Codex sign-in required", "waiting": "Waiting for Codex sign-in",
               "limited": "Codex usage limit", "unavailable": "Codex account unavailable", "error": "Codex sign-in failed"}.get(account.get("state"), "Codex setup required")
    return {"ready": readiness.get("ready", False) and account.get("state") == "connected", "message": message, "coreReady": readiness.get("ready", False), "capabilities": capabilities, "account": account,
            "repository": settings.agentroom_repository.name, "baseline": settings.agentroom_baseline}


@app.post("/threads/{thread_id}/start", dependencies=[Depends(authorize)])
def start(thread_id: str):
    validate_id(thread_id)
    with mutation_lock:
        record = binding_path(thread_id)
        if record.exists():
            info = binding(thread_id)
        else:
            base = git(settings.agentroom_repository, "rev-parse", "--verify",
                       settings.agentroom_baseline + "^{commit}")
            info = {"base": base, "branch": "agentroom/" + thread_id}
            write_json(record, info)
        core("POST", "/v1/sessions", {"request_id": thread_id, "harness": "codex", "workspace": thread_id})
        for _ in range(40):
            current = state(thread_id)
            if current["state"] == "idle":
                break
            if current["state"] in {"failed", "process_lost", "closed"}:
                raise HTTPException(409, current.get("startup_reason") or "Core could not start Codex")
            time.sleep(.25)
        else:
            raise HTTPException(503, "Core is still starting. Retry this same task identity to reconcile.")
        mapped = core("GET", f"/v1/sessions/{sid(thread_id)}/workspace")
        path = Path(mapped["path"])
        inspected = worker("inspect", path, root=str(settings.agentroom_workspaces))
        if not info.get("path"):
            if inspected["occupied"]:
                # A prior add may have succeeded before the binding write. Verify exactly.
                if git(path, "symbolic-ref", "--short", "HEAD") != info["branch"]:
                    raise HTTPException(409, "Workspace is occupied; manual reconciliation is required")
                if git(path, "rev-parse", "HEAD") != info["base"]:
                    raise HTTPException(409, "Unrecorded workspace changed; manual reconciliation is required")
            else:
                git(settings.agentroom_repository, "worktree", "add", "-b", info["branch"], str(path), info["base"])
            info["path"] = str(path)
            write_json(record, info)
        workspace(thread_id)
        return {"sessionId": sid(thread_id), "baseCommit": info["base"], "workspace": str(path), "branch": info["branch"]}


@app.get("/threads/{thread_id}/state", dependencies=[Depends(authorize)])
def read_state(thread_id: str):
    return state(thread_id)


@app.get("/threads/{thread_id}/events", dependencies=[Depends(authorize)])
def events(thread_id: str, after: int = 0):
    if after < 0:
        raise HTTPException(422, "Invalid cursor")
    return core("GET", f"/v1/sessions/{sid(thread_id)}/events?after={after}")


class Command(BaseModel):
    id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    kind: Literal["prompt", "stop", "resume"]
    text: str = Field(default="", max_length=32768)


def stop(thread_id: str, request_id: str):
    route = f"/v1/sessions/{sid(thread_id)}"
    core("POST", route + "/stop", {"request_id": request_id + "_pause"})
    for _ in range(30):
        current = state(thread_id)
        if current.get("queue_paused"):
            break
        time.sleep(.1)
    else:
        raise HTTPException(503, "Queue pause is unconfirmed. Retry this Stop identity to reconcile.")
    target = current.get("current_request")
    if target:
        # Derive the interrupt identity from the target too, to reconcile a race safely.
        suffix = hashlib.sha256(target.encode()).hexdigest()[:10]
        core("POST", route + "/interrupt", {"request_id": request_id + "_" + suffix, "target_request_id": target})
    return {"queuePaused": True, "interruptRequested": bool(target), "state": state(thread_id)}


@app.post("/threads/{thread_id}/command", dependencies=[Depends(authorize)])
def command(thread_id: str, value: Command):
    with mutation_lock:
        workspace(thread_id)
        if value.kind == "stop":
            return stop(thread_id, value.id)
        if value.kind == "prompt":
            if not value.text.strip() or len(value.text.encode()) > 32768:
                raise HTTPException(422, "Prompt must contain 1–32768 UTF-8 bytes")
            return core("POST", f"/v1/sessions/{sid(thread_id)}/prompts", {"request_id": value.id, "text": value.text})
        return core("POST", f"/v1/sessions/{sid(thread_id)}/resume", {"request_id": value.id})


def capture_tree(path: Path, base: str, parent: Path) -> str:
    return worker("tree", path, base=base)["tree"]


@app.post("/threads/{thread_id}/review", dependencies=[Depends(authorize)])
def review(thread_id: str):
    with mutation_lock:
        assert_idle(thread_id)
        path, info = workspace(thread_id), binding(thread_id)
        directory = binding_path(thread_id).parent
        tree = capture_tree(path, info["base"], directory)
        # Detect background writes while freezing the index, without changing the worktree's index.
        if tree != capture_tree(path, info["base"], directory):
            raise HTTPException(409, "Workspace changed during capture; retry after its writers stop")
        assert_idle(thread_id)
        raw = base64.b64decode(worker("patch", path, base=info["base"], tree=tree)["patch"], validate=True)
        patch = raw.decode(errors="replace")
        if len(raw) > 20 * 1024 * 1024:
            raise HTTPException(413, "Patch exceeds the 20 MiB review limit; inspect it on the runner")
        git(path, "update-ref", "refs/agentroom/snapshots/" + tree, tree)
        result = {"snapshot": tree, "baseCommit": info["base"], "branch": info["branch"],
                  "patchHash": hashlib.sha256(raw).hexdigest(), "patch": patch[:150000],
                  "truncated": len(patch) > 150000,
                  "files": git(path, "diff", "--name-status", info["base"], tree).splitlines(),
                  "tests": None, "capturedAt": int(time.time() * 1000)}
        patch_path = directory / (tree + ".patch")
        temporary = patch_path.with_suffix(".patch.tmp")
        with temporary.open("wb") as file:
            file.write(raw)
            file.flush()
            os.fsync(file.fileno())
        temporary.replace(patch_path)
        write_json(directory / (tree + ".json"), result)
        return result


@app.get("/threads/{thread_id}/patch/{snapshot}", dependencies=[Depends(authorize)])
def export_patch(thread_id: str, snapshot: str):
    if not HASH.fullmatch(snapshot):
        raise HTTPException(422, "Invalid snapshot")
    directory = binding_path(thread_id).parent
    try:
        metadata = json.loads((directory / (snapshot + ".json")).read_text())
        raw = (directory / (snapshot + ".patch")).read_bytes()
    except FileNotFoundError as exc:
        raise HTTPException(404, "Capture this snapshot before exporting") from exc
    if hashlib.sha256(raw).hexdigest() != metadata["patchHash"]:
        raise HTTPException(409, "Stored patch integrity check failed")
    return Response(raw, media_type="text/x-patch", headers={"Content-Disposition": f'attachment; filename="agentroom-{snapshot[:12]}.patch"'})
