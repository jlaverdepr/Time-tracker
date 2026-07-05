# Time Tracker

A work time tracking app: manage projects and subprojects, log work sessions, track to-dos, and review activity on a calendar and dashboard.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind CSS, Radix UI, TanStack Query, Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, `drizzle-zod`
- API codegen: Orval (generates typed React Query hooks + Zod schemas from the OpenAPI spec)
- Build: esbuild (API server bundle)

## Repo layout

- `artifacts/time-tracker` — main React frontend (dashboard, projects, sessions, calendar, to-dos)
- `artifacts/api-server` — Express API server (projects, subprojects, sessions, todos, health routes)
- `artifacts/date-app` — standalone interactive "date ask" app
- `artifacts/mockup-sandbox` — UI mockup/component sandbox
- `lib/db` — Drizzle schema and DB client (`projects`, `subprojects`, `sessions`, `todo`)
- `lib/api-spec` — OpenAPI spec (`openapi.yaml`) and Orval codegen config
- `lib/api-zod` — generated Zod schemas from the API spec
- `lib/api-client-react` — generated React Query hooks from the API spec
- `scripts` — misc workspace scripts

## Getting started

```bash
pnpm install
```

Required env var: `DATABASE_URL` — Postgres connection string.

```bash
pnpm --filter @workspace/db run push              # push DB schema (dev only)
pnpm --filter @workspace/api-server run dev        # run the API server (port 5000)
pnpm --filter @workspace/time-tracker run dev      # run the frontend
```

## Common commands

- `pnpm run typecheck` — typecheck all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec after changing `lib/api-spec/openapi.yaml`
