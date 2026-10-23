# Dependency choices

- Next.js / React / TypeScript: required web stack and server-rendered authentication boundary.
- Auth.js (`next-auth`): GitHub OAuth and encrypted server-validated session cookies; pinned beta API, revalidate on upgrade.
- TanStack Query: observable polling/cache state and reconnect refresh.
- Zod: runtime browser-API validation, including request identity and UTF-8 prompt limits.
- Prisma 6.19 plus `@prisma/adapter-pg`: metadata ORM and PostgreSQL's JavaScript driver, avoiding native application query-engine binaries.
- `@prisma/internals` 6.19: build-only generator orchestration using the packaged compiler. Its API is version-pinned; migration CLI still uses the standard Prisma path.
- Fontsource DM Sans / Manrope: self-hosted fonts with system fallbacks; no browser font CDN requests.
- Lucide React: consistent accessible UI icon components.
- FastAPI / Pydantic Settings: typed private execution API and protected configuration.
- httpx: bounded Core requests; no request-owned execution loop.
- uvicorn: one-worker private API service.
- pytest / Vitest: failure and contract tests; neither is used for agent-authored claims of success.

The exact JavaScript dependency graph is committed in `package-lock.json`; Python's is in `backend/uv.lock`. The source runtime and harness are pinned separately in `runtime.lock.json`.
