# AgentRoom

A private web workspace for persistent Codex tasks and reviewable Git changes.

The first implementation includes a responsive Next.js interface, owner-restricted GitHub OAuth, PostgreSQL/Prisma metadata, a private FastAPI/Core adapter, durable request identities, replay, compound Stop/resume, separate task worktrees, snapshot-bound patch exports, and recorded owner review decisions.

Start with [the setup guide](docs/SETUP.md). The confirmed design is in [ARCHITECTURE.md](ARCHITECTURE.md), dependency rationale in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md), and implementation checks in [docs/VALIDATION.md](docs/VALIDATION.md).

```sh
python3 scripts/init-env.py
npm ci
npm run db:generate
docker compose up -d postgres
npm run db:migrate
npm run dev
```

Configure owner OAuth and the protected execution service before submitting real work. The initial page shows setup status when these are missing. See the guide for the separate Python service and pinned Core/Codex setup.

This is the initial task flow, not the completed 16-week alpha described in the product plan. Fixture contract checks do not establish real inference, production isolation, or backup/restore readiness. Those remaining gates are explicit in the setup and validation documents.
