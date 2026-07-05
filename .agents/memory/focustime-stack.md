---
name: FocusTime stack
description: Monorepo structure, tech choices, and key conventions for the FocusTime work tracker
---

## Stack
- **Monorepo**: pnpm workspaces
- **Frontend**: React + Vite at `artifacts/time-tracker` (preview path `/`)
- **Backend**: Express 5 at `artifacts/api-server` (port from `$PORT`)
- **DB**: PostgreSQL via Drizzle ORM; schema in `lib/db/src/schema/`
- **API contract**: OpenAPI-first at `lib/api-spec/openapi.yaml`; codegen via orval v8.18 into `lib/api-client-react` (React Query hooks) and `lib/api-zod` (Zod validators)

## Key conventions
- Mutation call shape (orval): `mutate({ id })` for id-only ops; `mutate({ data: Input })` for creates; `mutate({ id, data: Update })` for updates
- After any schema change: `pnpm --filter @workspace/db run push`
- After any openapi.yaml change: orval codegen then `pnpm run typecheck:libs` (rebuilds .d.ts) before running package typechecks
- API server uses `date-fns` (must be in its own package.json; workspace root doesn't provide it)

**Why:** The build step uses esbuild which won't resolve workspace-root-only deps for the api-server bundle.
