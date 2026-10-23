# AgentRoom setup

This repository contains the first browser task flow, not a completed production alpha. Authentication, a real Codex account, the protected native runtime, and the deployment checks below are required before real use. The app has no demo-login bypass.

## Development dependencies and network

Use Linux, Node.js 24, Python 3.12+, `uv`, Docker Compose, Git, and Rust 1.89+ for building the pinned Core. Allow package registries, GitHub/codeload, Rust downloads, and **`binaries.prisma.sh`** in the environment's network policy. The last hostname was blocked in the development environment; add it through environment configuration before running Prisma migrations. Do not disable TLS or checksum verification. Provider authentication/inference and GitHub OAuth also need their documented endpoints allowed on the actual runner.

```sh
python3 scripts/init-env.py
npm ci
npm run db:generate
docker compose up -d postgres
npm run db:migrate
cd backend
uv sync --frozen
```

The initializer creates distinct random application/session/database credentials in a mode-0600 `.env` and refuses to overwrite an existing file. The example contains no usable credentials. Keep `.env` out of Git and the agent account's files. The application uses Prisma's JavaScript PostgreSQL driver; the pinned generator helper uses Prisma's packaged WASM compiler. Native Prisma migration tooling still needs the allowed engine host. The initial migration is in `prisma/migrations`; apply schema changes through Prisma migrations only.

Start the web app from the repository root with `npm run dev`. Start the private service from `backend/` with `uv run uvicorn app:app --host 127.0.0.1 --port 8000 --workers 1`. The API is deliberately a single worker so workspace mutation locks serialize operations. The database also constrains admission across web processes. Do not run inference under the same user as application credentials.

## GitHub owner sign-in

Create a GitHub OAuth app. Use `http://localhost:3000` during local development, with callback `http://localhost:3000/api/auth/callback/github`; replace both with the final HTTPS hostname in production. Set `AUTH_URL`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AGENTROOM_OWNER_GITHUB`, and `AGENTROOM_OWNER_GITHUB_ID` in the protected web configuration. The numeric GitHub ID prevents a reassigned username from inheriting access. Keep `AUTH_SECRET` random and stable across restarts. The owner and final hostname were intentionally left undecided.

## Pinned Core and Codex

```sh
python3 scripts/prepare-runtime.py
python3 scripts/check-core-fixtures.py .runtime/cloudroom-core-7d25d300f8ca564beb16541118f13daf89512a14
```

This builds the exact revision in `runtime.lock.json` and installs Codex 0.154.0 separately under `.runtime/harness`. It does not modify a global Codex installation or copy an existing account's credentials. The published Core 0.1.69 binary reports a different commit, so the setup builds the pinned source instead. Downloaded source includes its upstream license and notices; retain them if redistributing it.

On the target Linux host, follow the **manual protected setup** in the downloaded Core's `docs/setup.md`: create separate `cloudroom` service and `cloudroom-agent` execution accounts, configure delegated cgroups/storage protection, and install the locally built binary and pinned harness in root-owned system locations. Keep Node.js 24 on the system PATH. Keep Core bound to `127.0.0.1:9840`, use `CLOUDROOM_LOCAL_HISTORY=1`, and keep its journal, service token, and native harness history durable. Core's documented `install/configure.py` and service unit provide its protection setup. Do not run the upstream latest-version installer over this pinned build. Do not use `CLOUDROOM_UNPROTECTED_TEST_MODE` for live deployment.

The agent account must have neither sudo permissions nor a Docker socket. It can access its own workspaces, so this is a single-trusted-owner topology. Core container mode has different protections and is not a replacement for this native setup.

Complete the provider login under `cloudroom-agent` using the pinned Codex's `login --device-auth` command. The owner completes the provider's browser sign-in. Do not paste credentials into chat or copy this development environment's login. Configure a model supported by that account and verify Core's `/v1/accounts/codex`, `/v1/ready`, and `/v1/capabilities`. The app requires account state `connected` before enabling task submission.

## Repository and privileged boundaries

Prepare a disposable Git repository named `/code/fixture`, owned by `cloudroom-agent`, with a committed `main` branch. Configure `AGENTROOM_REPOSITORY=/code/fixture`, `AGENTROOM_WORKSPACES=/code`, and `AGENTROOM_BASELINE=main`. Core allocates the thread folder; the adapter creates its branch/worktree before submitting a prompt. The original checkout remains intact.

Run the web and Python services as a separate `agentroom` account. Put the application in `/opt/agentroom`, root-owned and not writable by `cloudroom-agent`. Create `/var/lib/agentroom/snapshots` owned by `agentroom`, mode 0700. The agent receives no access to that directory or `/etc/agentroom`.

The execution adapter uses `backend/workspace_worker.py` to perform Git/file operations as `cloudroom-agent`, without inheriting application credentials. Validate and install `ops/agentroom-workspace.sudoers` using `visudo`; it permits only this exact helper invocation as the agent user, never root. Set this JSON array in the protected execution environment:

```text
AGENTROOM_WORKSPACE_COMMAND=["sudo","-n","-u","cloudroom-agent","--","/usr/bin/python3","/opt/agentroom/backend/workspace_worker.py"]
```

The empty command default is for same-user local fixture tests only. Do not use it with live application secrets and an agent running as that same user. The API writes immutable exported patch bytes and integrity metadata itself; helper processes receive only validated operation data on stdin.

## Production services

Review the templates in `ops/`. Adjust the Node executable location if needed. Build with `npm run build`; use the locked dependencies. Split configuration into `/etc/agentroom/web.env` and `/etc/agentroom/execution.env`, readable only by `agentroom`. The web service needs database/OAuth/session settings and the execution URL/token. The execution service needs that same execution token, the Core URL/token, repository paths, and helper command. It does not need OAuth or database credentials. Keep the Core token out of the web environment.

Run PostgreSQL locally with a private listener and durable volume. Apply `npm run db:migrate` before starting the new app version. Install/enable the web and execution systemd units after their paths/accounts/configuration exist. Put an HTTPS reverse proxy in front of port 3000; preserve its original Host and forwarded protocol, and set Auth.js trusted-host configuration only for that controlled proxy. Do not expose ports 5432, 8000, or 9840 publicly.

## Real runtime gate

```sh
backend/.venv/bin/python scripts/prove-runtime.py
```

Run only after protected Core, Codex login, and the disposable fixture are configured. The script submits one real task, retries the same request identity, waits for the actual receipt, and verifies the requested change in the captured patch. It records `work/runtime-proof.json`. It does not replace the separate interruption/restart and restore demonstrations required for the full alpha. A fixture check is never reported as real inference.

## Backups, upgrades, and recovery

Set `AGENTROOM_BACKUP_DESTINATION` as the operator's intended off-host destination. Automatic backup scheduling is not implemented in this first slice. Before a consistent backup, drain Core and wait for work to settle; stop app mutations; then capture PostgreSQL (`pg_dump`), Core's journal, native Codex history, the fixture/project Git repository including worktree metadata, all retained task worktrees, and `/var/lib/agentroom/snapshots` together. Encrypt and protect credential backups separately. Resume services only after the coordinated copy completes. Never delete an unreviewed worktree to free space automatically.

Before declaring production readiness, restore this set to a disposable host, check every retained thread's native history, and reopen its matching patch. Do not reset a pending action or automatically reissue an uncertain task. The UI preserves request identities and supports retrying the same saved action; investigate external effects before intentionally submitting new work.

## Remaining alpha work

- Real ChatGPT-backed inference, protected native-host deployment, and GitHub OAuth have not been exercised in this environment.
- The migration CLI is blocked until `binaries.prisma.sh` is allowed; the SQL artifact can be validated in a disposable test database independently.
- Trusted test execution/evidence, automatic backup/restore tooling, retention UI, resource metering, archive controls, and the two-week pilot remain later milestones.
- Timeline replay polls every 1.5 seconds and displays the newest 1,500 events with an explicit notice. Earlier events remain in Core; full historical pagination/virtualization is future work.

References checked during implementation: [pinned Core setup](https://github.com/davidondrej/cloudroom-core/blob/7d25d300f8ca564beb16541118f13daf89512a14/docs/setup.md), [provider authentication](https://developers.openai.com/codex/auth/), and [Vercel AI SDK](https://ai-sdk.dev/docs/introduction). Core remains the dispatcher; no second AI SDK execution loop is introduced.
