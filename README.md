# FocusTime

Local-first time tracking and habit logging app for projects, subprojects, work sessions, to-dos, gym workouts, and runs.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind CSS, Radix UI, TanStack Query, Wouter
- API: Express 5
- Desktop: Electron + electron-builder
- DB: local SQLite via `better-sqlite3` and Drizzle ORM
- Validation and API contract: OpenAPI, Orval-generated React Query hooks, Zod schemas

## Repo Layout

- `artifacts/time-tracker` - main React app
- `artifacts/api-server` - Express API mounted under `/api`
- `desktop` - Electron wrapper that starts the local API, runs migrations, and serves the built frontend
- `lib/db` - SQLite client, Drizzle schema, and migrations
- `lib/api-spec` - OpenAPI source and Orval config
- `lib/api-client-react` - generated React Query API client
- `lib/api-zod` - generated Zod request/response schemas used by the API

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create/update the local development database:

```bash
pnpm run db:push
```

Run the API server and web app in separate terminals:

```bash
pnpm run dev:api
pnpm run dev:web
```

Defaults:

- API: `http://localhost:5000/api`
- Web app: Vite's printed localhost URL, usually `http://localhost:5173`
- Development DB: `.local/time-tracker.sqlite`

Override the local API port or database path when needed:

```bash
PORT=5050 DB_PATH=.local/custom.sqlite pnpm run dev:api
```

## Desktop Build

Build the packaged macOS desktop app:

```bash
pnpm run build:desktop
```

Generated desktop outputs live under `desktop/dist*` and are intentionally ignored by Git.

## Common Commands

- `pnpm run typecheck` - typecheck all packages
- `pnpm run build` - typecheck and build every package with a build script
- `pnpm --filter @workspace/api-spec run codegen` - regenerate API hooks and Zod schemas after editing `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run generate` - generate Drizzle migration files after schema changes
- `pnpm run db:push` - push current schema to the local development SQLite database

## Development Notes

- Keep `lib/api-spec/openapi.yaml`, generated clients, API routes, and DB schema in sync.
- Commit Drizzle migration files from `lib/db/drizzle` when schema changes are intentional.
- Do not commit generated build outputs, local SQLite files, `node_modules`, or `.pnpm-store`.
- The desktop app runs migrations at startup against the user's local SQLite database.
