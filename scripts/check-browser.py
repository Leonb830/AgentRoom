#!/usr/bin/env python3
"""Browser/API integration using disposable DB, test-only sessions and fixture Codex.

Invoked by check-database.mjs. Requires Playwright Python and system Chromium.
No authentication bypass is added to production code; a signed test cookie is
issued with a random test secret to a separate local server.
"""
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(sys.argv[1]).resolve() / "tests"))
from core_fixture import ReplayTests
from core_e2e import run


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


fixture = ReplayTests()
fixture.setUp()
children, logs = [], []
try:
    folder = Path(fixture.env["CLOUDROOM_ACCOUNT_HOME"]) / ".local/bin"
    folder.mkdir(parents=True)
    (folder / "node").symlink_to(shutil.which("node"))
    run("git", "-C", str(fixture.repo), "symbolic-ref", "HEAD", "refs/heads/main")
    (fixture.repo / "hello.txt").write_text("before\n")
    (fixture.repo / ".gitignore").write_text("*.requests\n")
    run("git", "-C", str(fixture.repo), "add", ".")
    run("git", "-C", str(fixture.repo), "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "baseline")
    fixture.start()
    web_port, api_port = free_port(), free_port()
    origin = f"http://127.0.0.1:{web_port}"
    secret, service_token = secrets.token_hex(32), secrets.token_hex(32)
    environment = {**os.environ, "AUTH_SECRET": secret, "AUTH_URL": origin, "AUTH_TRUST_HOST": "true",
        "AUTH_GITHUB_ID": "test-only", "AUTH_GITHUB_SECRET": "test-only", "AGENTROOM_OWNER_GITHUB": "fixture",
        "AGENTROOM_OWNER_GITHUB_ID": "991100", "EXECUTION_TOKEN": service_token,
        "EXECUTION_URL": f"http://127.0.0.1:{api_port}", "CLOUDROOM_URL": "http://" + fixture.service.address,
        "CLOUDROOM_TOKEN": fixture.env["CLOUDROOM_TOKEN"], "AGENTROOM_REPOSITORY": str(fixture.repo),
        "AGENTROOM_WORKSPACES": str(fixture.state / "code"), "AGENTROOM_SNAPSHOTS": str(fixture.root / "snapshots"),
        "AGENTROOM_BASELINE": "main", "AGENTROOM_WORKSPACE_COMMAND": "[]"}
    commands = [([str(ROOT / "backend/.venv/bin/uvicorn"), "app:app", "--host", "127.0.0.1", "--port", str(api_port)], ROOT / "backend"),
                (["node", "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", str(web_port)], ROOT)]
    for index, (command, cwd) in enumerate(commands):
        log = (ROOT / f"work/browser-service-{index}.log").open("w")
        logs.append(log)
        children.append(subprocess.Popen(command, cwd=cwd, env=environment, stdout=log, stderr=subprocess.STDOUT))
    for _ in range(100):
        try:
            with urllib.request.urlopen(origin, timeout=1) as response:
                if response.status == 200: break
        except (urllib.error.URLError, TimeoutError): pass
        time.sleep(.1)
    else: raise AssertionError("Web server did not start")
    # Tokens stay in subprocess memory and the isolated browser context, never logs/artifacts.
    encoder = 'import {encode} from "next-auth/jwt"; process.stdout.write(await encode({token:{sub:"991100",name:"Fixture owner"},secret:process.env.AUTH_SECRET,salt:"authjs.session-token"}));'
    cookie = subprocess.check_output(["node", "--input-type=module", "-e", encoder], cwd=ROOT, env=environment, text=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=shutil.which("chromium"), headless=True, args=["--no-sandbox"])
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        failures = []
        page.on("pageerror", lambda error: failures.append(str(error)))
        assert context.request.get(origin + "/api/room/bootstrap").status == 401
        await_cookie = {"name": "authjs.session-token", "value": cookie, "url": origin, "httpOnly": True, "sameSite": "Lax"}
        context.add_cookies([await_cookie])
        page.goto(origin)
        expect(page.get_by_text("Runner connected", exact=True)).to_be_visible(timeout=20000)
        page.screenshot(path=str(ROOT / "work/workspace-desktop.png"), full_page=True)
        page.get_by_role("textbox", name="Task description").fill("reply-first")
        page.get_by_role("button", name="Start task", exact=True).click()
        expect(page.get_by_text("Finished", exact=True)).to_be_visible(timeout=20000)
        data = context.request.get(origin + "/api/room/bootstrap").json()
        assert len(data["threads"]) == 1
        thread = data["threads"][0]["id"]
        metadata = json.loads((fixture.root / "snapshots" / thread / "binding.json").read_text())
        (Path(metadata["path"]) / "hello.txt").write_text("after fixture change\n")
        page.get_by_role("button", name="Capture changes", exact=True).click()
        expect(page.get_by_text("1 changed files", exact=True)).to_be_visible(timeout=15000)
        expect(page.get_by_text("No trusted test evidence recorded", exact=True)).to_be_visible()
        link = page.get_by_role("link", name="Export patch")
        patch = context.request.get(origin + link.get_attribute("href"))
        assert patch.ok and "+after fixture change" in patch.text()
        page.get_by_role("button", name="Accept snapshot", exact=True).click()
        expect(page.get_by_role("button", name="Snapshot accepted", exact=True)).to_be_visible()
        page.get_by_role("textbox", name="Follow-up message").fill("hello")
        page.get_by_role("button", name="Send follow-up", exact=True).click()
        expect(page.locator(".user-message")).to_have_count(2)
        expect(page.locator(".pending-notice")).to_have_count(0)
        page.get_by_role("button", name="Stop", exact=True).click()
        expect(page.get_by_text("Queue paused", exact=True)).to_be_visible()
        page.get_by_role("button", name="Resume queue", exact=True).click()
        expect(page.get_by_text("Finished", exact=True)).to_be_visible()
        expect(page.locator(".pending-notice")).to_have_count(0)
        assert context.request.post(origin + f"/api/room/threads/{thread}/review", data={}, headers={"Origin": "https://untrusted.example"}).status == 403
        page.screenshot(path=str(ROOT / "work/thread-desktop.png"), full_page=True)
        page.set_viewport_size({"width": 390, "height": 844})
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.get_by_role("button", name="Open navigation", exact=True).click()
        expect(page.get_by_role("button", name="New task")).to_be_visible()
        page.get_by_role("button", name="Close navigation", exact=True).click()
        page.screenshot(path=str(ROOT / "work/thread-mobile.png"), full_page=True)
        assert not failures, failures
        context.close()
        browser.close()
    print("PASS: browser task submission, Core-backed fixture completion, review/export/accept, owner API auth, origin checks, and mobile layout.")
    print("Signed test session and simulated harness only; GitHub OAuth and real inference remain unverified.")
finally:
    for child in reversed(children):
        child.terminate()
        try: child.wait(timeout=10)
        except subprocess.TimeoutExpired: child.kill(); child.wait()
    for log in logs: log.close()
    fixture.tearDown()
