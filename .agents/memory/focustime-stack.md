---
name: FocusTime stack
description: Monorepo structure, tech choices, and key conventions for the FocusTime work tracker
---

## Stack
- **Monorepo**: pnpm workspaces
- **Web**: React + Vite at `artifacts/time-tracker`; dev server proxies `/api` to the API (`API_URL`, default :5000)
- **Mobile**: Expo at `artifacts/mobile`; connects to a server URL + token
- **Backend**: Express 5 at `artifacts/api-server` (port from `$PORT`); optional bearer auth via `API_AUTH_TOKEN`; runs migrations on boot when `MIGRATIONS_DIR` is set; deployed to Fly.io (see DEPLOY.md)
- **Desktop**: Electron thin client of the deployed server (no local DB)
- **DB**: SQLite (better-sqlite3) via Drizzle ORM; schema in `lib/db/src/schema/`, migrations in `lib/db/drizzle/`
- **API contract**: OpenAPI-first at `lib/api-spec/openapi.yaml`; codegen via orval v8.18 into `lib/api-client-react` (React Query hooks) and `lib/api-zod` (Zod validators)
- **Shared logic**: `lib/shared` (`@workspace/shared`) holds helpers used by both web and mobile — dates, formatDuration, todo completion, gym utils, color palettes. Never duplicate these per app.

## Key conventions
- Mutation call shape (orval): `mutate({ id })` for id-only ops; `mutate({ data: Input })` for creates; `mutate({ id, data: Update })` for updates
- Web: after any session create/update/delete call `invalidateSessionQueries` from `src/lib/session-queries.ts`
- Dates: use `todayStr()`/`toDateStr()` from `@workspace/shared` (local calendar date) — never `toISOString().slice(0, 10)` (UTC)
- After any openapi.yaml change: orval codegen then `pnpm run typecheck:libs` (rebuilds .d.ts) before running package typechecks
- API server uses `date-fns` (must be in its own package.json; workspace root doesn't provide it)

**Why:** The build step uses esbuild which won't resolve workspace-root-only deps for the api-server bundle.
