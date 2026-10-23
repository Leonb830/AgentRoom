# AgentRoom architecture

## Status and confirmed scope

Discovery completed in two batches on 21 October 2026. The owner confirmed a runtime proof followed by a working browser task flow; Next.js owns authentication and Prisma metadata, FastAPI owns execution and review; GitHub OAuth admits one configured owner; one Linux host is the deployment target, with Docker Compose for development. Set up Core and Codex. Use a disposable Git fixture for the first real task, ChatGPT sign-in for Codex, unattended execution without privilege escalation, manual cleanup, retained history and unreviewed work, and a configurable backup destination. The GitHub owner and hostname remain intentionally unset deployment configuration.

The product plan is the requirements baseline. `AGENTS.md` overrides its earlier Vite/Hono/SQLite choices. This is a trusted-owner alpha, not unrelated-user hosting. One task executes at a time. No automatic merge, deployment, delegation, billing, or fleet management.

## System overview

Browser → Next.js authenticated product API → FastAPI execution/review adapter → pinned Cloudroom Core → native Codex. Next.js → Prisma → PostgreSQL stores product identity and decisions. Core's local journal owns execution receipts, queue state, and native events. Workspace snapshots own review/test evidence. HTTP connections do not own task lifetime.

## Frontend

Next.js App Router, TypeScript, TanStack Query for server state, and Zod at request boundaries. Local drafts are independent of accepted commands. Projects, threads, timeline, queue controls, review, and readiness are the primary views. Distinguish accepted, running, blocked, interrupted, failed, unknown, and finished from owner acceptance. Render runtime output as text; do not execute imported HTML. Provide responsive layouts and accessible controls. Native events are replayed by cursor, deduplicated by session and sequence; sequence gaps alone are not failures.

## Backend and API

Next.js is the browser-facing backend for authentication, metadata, authorization, and proxying. FastAPI is a private service for Core integration and filesystem operations. It accepts a distinct server-only service token. Core credentials never enter browser payloads. Core and FastAPI bind to loopback in native deployment; expose only the web application behind TLS.

FastAPI runs as the trusted application account. A root-owned, narrowly sudo-authorized workspace helper performs Git operations as the separate unprivileged agent account. Only JSON operation inputs cross this boundary; the helper's environment excludes application and Core credentials. Exported snapshot bytes and binding metadata stay in application-owned storage. Same-user helper execution is restricted to disposable local fixtures.

Persist each user action's request identity and canonical payload hash before dispatch. Retries reuse the identity, changed content conflicts, and uncertain dispatch is reconciled against Core. Never replay uncertain execution as a new command. Core remains the only prompt dispatcher. Session and workspace references come from server-owned bindings, never arbitrary browser paths.

Stop is compound: pause the queue, inspect the active request, interrupt that request if necessary, then reconcile. Partial failure stays visible. Explicit resume uses a new durable action identity and does not resend uncertain prompts. Initially use bounded event polling with Core's replay cursor; this implements reconnect without coupling execution to subscriptions. SSE may replace polling after the same replay contract passes.

## Database

PostgreSQL runs locally in Docker. Prisma's supported TypeScript client is used only by Next.js. FastAPI has no independent ORM or competing execution database. Prisma migrations own schema changes. Store projects, threads and native session mapping, command IDs and payloads, review snapshots/decisions, and owner identity binding. Core events may be projected but are not an independent authoritative history. Use database constraints for uniqueness and atomic admission of one active thread; process-local locks are insufficient across web workers.

The initial project and owner are operator configuration, not editable database entities. Thread, Command, and Review are the first persisted models. An unresolved `pendingId` holds admission until the same action is reconciled; merely observing an idle runtime cannot release a request still being dispatched. Prisma uses `engineType = "client"` with the PostgreSQL driver adapter. Its version-pinned build helper uses the packaged compiler without native downloads; the migration CLI remains standard and requires its engine host to be reachable.

## Authentication

Use Auth.js GitHub OAuth with an exact configured owner allowlist. Fail closed if owner, OAuth credentials, or session secret are absent. All product routes, history, artifacts, and mutations require an authenticated owner. Same-origin checks protect cookie-authenticated mutations. OAuth login and runtime harness login are separate. Codex ChatGPT login must be completed by the owner under the dedicated agent account; never reuse this development environment's credentials. FastAPI service token and Core token are independent and protected.

## AI integration

Pin Core revision `7d25d300f8ca564beb16541118f13daf89512a14` (package 0.1.69) and initially Codex 0.154.0, the version documented as tested by that revision. Inspect the runtime's current capabilities and configured account before admission. Use provider documentation and current Vercel AI SDK documentation as integration references. Native Codex owns the model/tool loop; the app does not add an independent AI SDK dispatcher. The SDK is not a dependency unless an actual product feature requires it.

## Workspaces and review

Start with a disposable repository. Production projects are operator-configured roots. Prepare a separate Git worktree and branch with a recorded base revision for each thread. Preserve the original checkout. Worktrees separate edits, not security principals. Run agents in a dedicated unprivileged account without host administration or a Docker socket. Protected native Core uses a separate service account and delegated cgroups.

Review must include tracked and relevant untracked changes against the recorded base. Freeze an immutable Git tree/content snapshot, generate the patch from it, and identify review/export/test evidence by that snapshot. A trusted test runner records the configured command, exit status, timestamp, output, and tested snapshot; later edits make evidence stale. Agent statements are not test results. Do not claim passing tests before this evidence exists. Export never merges automatically. Cleanup requires explicit action and preserves unreviewed changes.

## Infrastructure and deployment

Target one Linux machine. Docker Compose provides PostgreSQL for development; Next.js and FastAPI may run as local supervised processes or services. Production Core is installed following its protected native Linux setup, with separate service/agent identities, cgroups, private listener, and local history. Do not substitute unprotected test mode for protected production setup. Document any fixture-only mode explicitly and prevent its results from being labeled real inference.

Provide environment examples without secrets, repeatable dependency locks, database migrations, health checks, a pinned runtime preparation command, and systemd deployment guidance. No external hosting purchase or publication is authorized or needed. The hosted Sites runtime cannot run this native process topology, so use the repository/self-hosted workflow.

## Backup and recovery

Retain history and unreviewed work by default. Back up PostgreSQL, the Core journal/native history, and required repository/workspace/snapshot files as a coordinated set. Backup destination is operator configured. Document restore and test it before declaring the operations milestone complete. No automatic expiry in the first version.

## Validation and release gates

M0 requires the pinned executable plus an authenticated Codex task, reconnect/idempotency/stop/recovery evidence, and exact changed-file access. Offline fixtures establish only contracts. Record blockers honestly; do not declare M0 complete without real inference. Validate browser API ownership, payload conflicts, event replay, queue pause, stale test evidence, type checking, migration consistency, and production build. Missing account/hostname settings block deployment readiness rather than enabling a demo login. Full pilot and backup/restore requirements remain release gates beyond initial implementation.

## Tradeoffs and known constraints

- Two backend languages add a private HTTP boundary but retain Prisma's supported client and Python execution services.
- Polling is simpler than proxying SSE initially; it adds bounded update latency and must support pagination.
- Owner-only OAuth is intentionally narrow; changing owners requires explicit configuration.
- Native Core's dedicated account shares filesystem access across its workspaces. It does not provide tenant isolation or a per-command approval UI.
- Container Core has weaker/different protection semantics than native cgroup deployment; do not silently replace the agreed production boundary.
- This development environment has a newer Codex installation, which must remain untouched. Install the pinned harness separately.
- Account sign-in and final production hostname/owner configuration require owner input. Do not collect secrets in chat.

## Future considerations

After the complete alpha flow is demonstrated: GitHub PR publishing from reviewed snapshots, additional harnesses, SSE subscriptions, richer resource diagnostics, and separate protected installations for testers. Delegation, environment handoff, and commercial multi-tenancy need separate architecture work.
