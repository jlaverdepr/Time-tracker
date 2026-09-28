# FocusTime

Time tracking and habit logging for projects, subprojects, work sessions, to-dos, gym workouts, runs, and body weight. One always-on server (see [DEPLOY.md](DEPLOY.md)) backs the web/desktop app and the phone app, so data logged on either shows up on both.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind CSS, Radix UI, TanStack Query, Wouter
- API: Express 5
- Desktop: Electron + electron-builder
- Mobile: Expo / React Native
- DB: local SQLite via `better-sqlite3` and Drizzle ORM
- Validation and API contract: OpenAPI, Orval-generated React Query hooks, Zod schemas

## Repo Layout

- `artifacts/time-tracker` - main React web app
- `artifacts/api-server` - Express API mounted under `/api`; runs migrations on boot, optionally serves the built web app (`STATIC_DIR`) and requires a bearer token when `API_AUTH_TOKEN` is set
- `artifacts/mobile` - Expo phone app; connects to the server with a URL + token
- `desktop` - Electron thin client: asks for the server URL + token once, then loads the web app from that server
- `tester-app` - standalone, headless build for sharing with testers (see [Tester Build](#tester-build) below) — fully separate from `desktop`, never updated as a side effect of working on the main app
- `lib/db` - SQLite client, Drizzle schema, and migrations
- `lib/api-spec` - OpenAPI source and Orval config
- `lib/api-client-react` - generated React Query API client
- `lib/api-zod` - generated Zod request/response schemas used by the API
- `lib/shared` - platform-neutral helpers used by both the web and mobile apps (dates, duration formatting, to-do completion, gym utils, color palettes). Put logic here instead of copying it between apps.

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
- Web app: `http://localhost:5173` — Vite proxies `/api` to the API (override the target with `API_URL=...`)
- Development DB: `.local/time-tracker.sqlite`

Override the local API port or database path when needed:

```bash
PORT=5050 DB_PATH=.local/custom.sqlite pnpm run dev:api
```

## Mobile App

```bash
pnpm --filter @workspace/mobile run start
```

Scan the QR code with Expo Go, then enter your server URL and access token on the connect screen.

## Deployment

See [DEPLOY.md](DEPLOY.md) for running the API + web app on Fly.io (`Dockerfile`, `fly.toml`).

## Desktop Build

Build the packaged macOS desktop app (a thin client — it holds no data itself; point it at your deployed server on first launch, or change it later via *FocusTime → Server Settings…*):

```bash
pnpm run build:desktop
```

Generated desktop outputs live under `desktop/dist*` and are intentionally ignored by Git.

## Tester Build

`tester-app` is a separate, headless build meant for sharing with testers who shouldn't have to install anything. Double-clicking it starts the local API/DB (its own isolated data folder — never shares data with `desktop`'s stable/beta builds) and opens the app in the system's default browser instead of an Electron window. A small tray/menu-bar icon lets a tester reopen the tab or quit.

It's intentionally its own package, not a mode of `desktop`, so iterating on the main app never touches or silently updates what testers already have. Only rebuild and re-release it when you deliberately want to ship testers a new version.

Build it:

```bash
pnpm --filter tester-app run build:mac   # -> tester-app/dist/*.dmg
pnpm --filter tester-app run build:win   # -> tester-app/dist/*.exe (portable, no installer)
```

Neither build is code-signed (no paid developer certificate), so macOS Gatekeeper and Windows SmartScreen will both show an "unidentified developer" warning testers need to click through once.

Distribute the built `.dmg`/`.exe` as attachments on a GitHub Release — don't commit them to the repo.

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
- The API server applies pending migrations on boot when `MIGRATIONS_DIR` is set (the Docker image and tester-app do this). For local dev, use `pnpm run db:push`.
