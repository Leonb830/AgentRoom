# Implementation validation — 21 October 2026

## Passed

| Check | Result and scope |
| --- | --- |
| Production web build | `npm run build` passes, including strict TypeScript validation and the packaged Prisma client generator. |
| TypeScript contract checks | Five Vitest tests pass: UTF-8 input limits, payload identity, safe admission release, event deduplication, and truthful status. |
| Python execution/review checks | Seven pytest tests pass: API authentication, untracked-file capture and original-checkout preservation, refusal to capture active work, patch-integrity verification, pause-before-interrupt identity, path identity validation, and separation of Core readiness from account authentication. |
| Exact pinned Core build | Revision `7d25d300f8ca564beb16541118f13daf89512a14` builds with Rust 1.89 using its locked dependencies. The release binary with the same version label was rejected as a substitute because its recorded commit differs. |
| Core contract checks | Seven upstream fixture checks pass for API authentication, workspace metadata, replay isolation, duplicate acceptance, graceful restart, persistent queue pause, and native-history recovery preflight. A test-only Node shim supplies the environment's non-system Node path. |
| Core-backed adapter integration | Actual Core executable plus upstream simulated Codex: start/retry, prompt/retry, replay, Stop/resume, independent worktree, captured snapshot, exact patch export, and original-checkout preservation pass. |
| PostgreSQL | Docker PostgreSQL 17 starts. The initial migration SQL and Prisma client are tested in a newly created disposable database. Relations, review records, and the unique runtime-admission constraint pass. The test database is dropped afterward. |
| Browser integration | Chromium/Playwright on desktop and 390px mobile: task submission, fixture completion, follow-up, Stop/resume, capture, patch download, acceptance, unauthenticated API rejection, foreign-origin mutation rejection, and mobile navigation pass with no page errors or horizontal overflow. |
| Setup page | Unconfigured-owner landing page, expandable setup instructions, desktop/mobile layouts, and browser runtime checks pass. |

The browser checks use a random test signing secret and a disposable owner session on a separate local server. No test-login route or production authentication bypass was added. The harness and resulting code modification in these checks are fixtures. These checks do not prove that a real model account has executed work.

## Reproduce

```sh
npm run typecheck
npm test
npm run build
cd backend
uv run pytest -q
cd ..
python3 scripts/check-core-fixtures.py .runtime/cloudroom-core-7d25d300f8ca564beb16541118f13daf89512a14
backend/.venv/bin/python scripts/check-adapter.py .runtime/cloudroom-core-7d25d300f8ca564beb16541118f13daf89512a14
node scripts/check-database.mjs
```

For the full browser fixture, install Playwright Python and a system Chromium executable, then run:

```sh
node scripts/check-database.mjs --browser .runtime/cloudroom-core-7d25d300f8ca564beb16541118f13daf89512a14
```

The disposable-database check reads the migration artifact directly solely for verification. Normal application deployment must use `npm run db:migrate` so Prisma owns migration history.

## Not verified / still required

- **Real M0 inference gate:** no owner ChatGPT login was supplied. Pinned Codex 0.154.0 is installed separately and its version is confirmed, but no real task has run. `scripts/prove-runtime.py` is ready for the configured protected runner.
- **Prisma migration CLI:** `binaries.prisma.sh` is denied by this environment's host policy. The client/build path works without native query-engine downloads; `prisma migrate deploy` still needs that hostname allowed. No checksum or TLS checks were disabled.
- **GitHub OAuth round trip:** owner identity, hostname, and OAuth credentials were intentionally left for deployment configuration. Browser tests validate session enforcement with test-issued credentials, not the external OAuth round trip.
- **Protected host installation:** the native account/cgroup topology, scoped sudo helper, TLS proxy, and systemd templates have not been deployed to a target host.
- **Later alpha milestones:** trusted test execution tied to snapshots, coordinated backup/restore proof, operational metrics/limits, retention/archive controls, full historical timeline navigation, and the pilot remain open.

The test environment emitted a Starlette warning about its current TestClient/httpx integration. Tests pass; it is a development-tool compatibility warning, not a claim of a runtime failure. The pinned upstream Rust build also emits a non-fatal pattern warning.
