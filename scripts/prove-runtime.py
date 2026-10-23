#!/usr/bin/env python3
"""Real inference smoke check. Requires an already authenticated protected runner."""
import json
import os
import time
import uuid
from pathlib import Path
import httpx
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / ".env")
if Path(os.environ.get("AGENTROOM_REPOSITORY", "")).name != "fixture":
    raise SystemExit("This proof is restricted to an operator-configured repository named fixture")
token = os.environ.get("EXECUTION_TOKEN")
if not token:
    raise SystemExit("Configure the private execution service first")
client = httpx.Client(base_url=os.getenv("EXECUTION_URL", "http://127.0.0.1:8000"),
                      headers={"Authorization": "Bearer " + token}, timeout=60, trust_env=False)

def call(method, path, body=None):
    response = client.request(method, path, json=body)
    response.raise_for_status()
    return response.json()

health = call("GET", "/health")
if not health["ready"]:
    raise SystemExit("Core, Codex authentication, and the fixture repository must all be ready")
thread, request = str(uuid.uuid4()), str(uuid.uuid4())
started = call("POST", f"/threads/{thread}/start", {})
marker = "AgentRoom real runtime proof " + request
prompt = {"id": request, "kind": "prompt", "text": f"Create only agentroom-proof.txt containing exactly this one line followed by a newline: {marker}. Do not change other files. Do not commit."}
call("POST", f"/threads/{thread}/command", prompt)
call("POST", f"/threads/{thread}/command", prompt)
print("Task accepted; retry used the same identity. Waiting for actual Codex completion.", flush=True)
deadline = time.monotonic() + 600
while time.monotonic() < deadline:
    state = call("GET", f"/threads/{thread}/state")
    receipt = state.get("receipts", {}).get(request, {})
    outcome = receipt.get("state")
    if outcome == "completed":
        break
    if outcome in {"failed", "interrupted", "unknown", "unknown_after_restart"}:
        raise SystemExit("Real task did not succeed: " + outcome + ". Inspect before issuing new work.")
    time.sleep(2)
else:
    raise SystemExit("Timed out observing; the accepted task may still be running. Do not reissue it.")
review = call("POST", f"/threads/{thread}/review", {})
if "+" + marker not in review["patch"]:
    raise SystemExit("Core reported completion but the captured patch did not contain the required change")
report = {"realInference": True, "thread": thread, "request": request, "snapshot": review["snapshot"],
          "base": started["baseCommit"], "duplicateSubmission": "same identity", "outcome": outcome}
(root / "work").mkdir(exist_ok=True)
(root / "work/runtime-proof.json").write_text(json.dumps(report, indent=2) + "\n")
print("PASS: real Codex task and exact patch verified. Evidence: work/runtime-proof.json")
print("The full alpha still requires real interruption/restart and backup/restore demonstrations.")
