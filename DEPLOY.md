# Deploying the FocusTime server

This turns the local-only server (previously bundled inside the desktop
app, only reachable on the same Wi-Fi as your Mac) into a small always-on
service that both the desktop app and the phone app talk to. One database,
reachable from anywhere — the Mac being on or off no longer matters.

I can't run these steps myself (they need your own Fly.io account and an
interactive browser login), so this is the exact sequence to run yourself.
Everything code-side is already in place: `Dockerfile`, `fly.toml`,
`.dockerignore` at the repo root.

## 0. Install the Fly CLI

```
brew install flyctl
fly auth login
```

(Sign up for a free Fly.io account first if you don't have one — the login
command will walk you through it.)

## 1. Launch the app (don't deploy yet)

From the repo root:

```
fly launch --no-deploy
```

- It'll detect the `Dockerfile` and `fly.toml` and ask to confirm/adjust
  the app name and region — pick whatever you like (region = wherever
  you'll use it most; doesn't need to match `sjc` in `fly.toml`, that's
  just a placeholder).
- If it asks about a Postgres/Redis database, say **no** — this app uses
  its own SQLite file on a volume, not a managed database.
- If it offers to overwrite `fly.toml`, let it — it'll keep your
  `[build]`, `[env]`, `[[mounts]]`, and `[http_service]` sections mostly
  intact; just double check `DB_PATH`, `MIGRATIONS_DIR`, and `STATIC_DIR`
  are still there under `[env]` afterwards (re-add them if it dropped
  them).

## 2. Create the persistent volume (for the SQLite file)

```
fly volumes create focustime_data --region <your-region> --size 1
```

(1GB is enormous overhead for a personal SQLite file — this app's current
local DB is ~150KB.) Use the same region you picked in step 1.

## 3. Set the access token

This is the one shared secret both the desktop app and the phone app will
use to authenticate — pick a long random value:

```
fly secrets set API_AUTH_TOKEN=$(openssl rand -hex 24)
```

To see the value you just set (you'll need to paste it into both apps):

```
fly ssh console -C 'printenv API_AUTH_TOKEN'
```

(Only works after the first deploy, since it reads it from a running
machine — or just generate it yourself first and pass a fixed value to
`fly secrets set` instead of `$(openssl rand -hex 24)`, so you already
have it written down.)

## 4. Deploy

```
fly deploy
```

This builds the Docker image (installs the whole workspace, builds
`api-server` and the `time-tracker` web UI, ~a few minutes the first
time) and ships it. When it finishes:

```
curl https://<your-app>.fly.dev/api/healthz
```

should return `{"status":"ok"}`.

## 5. Move your existing data onto the volume

Your current data lives on your Mac at
`~/Library/Application Support/FocusTime/time-tracker.sqlite`. The fresh
deploy just created an *empty* database at that same path on the volume —
overwrite it with your real one:

```
fly machine list                      # note the machine id
fly machine stop <machine-id>
fly sftp shell
> put "/Users/xkjula/Library/Application Support/FocusTime/time-tracker.sqlite" /data/time-tracker.sqlite
> exit
fly machine start <machine-id>
```

(Stopping the machine first avoids overwriting the file while the running
process still has it open.)

Re-check `curl https://<your-app>.fly.dev/api/healthz` afterwards, and
open the URL in a browser with `?token=<your-token>` appended once to
confirm your existing projects/sessions/gym data show up.

## 6. Point the phone app at it

In the mobile app: **More → Settings → Disconnect**, then reconnect via
the Connect screen with:
- Server address: `https://<your-app>.fly.dev`
- Token: the one from step 3

## 7. Rebuild and reinstall the desktop app

The desktop app no longer runs its own local server — it now needs a
rebuild to pick up that change:

```
pnpm --filter desktop run build
```

Install the resulting `.dmg` from `desktop/dist/`. On first launch it'll
show a small "Connect FocusTime" screen — enter the same URL and token as
step 6. (To reconfigure later: menu bar → FocusTime → **Server
Settings…**.)

## Notes

- `fly.toml` is currently set to `auto_stop_machines = "stop"` with
  `min_machines_running = 0` — the machine sleeps when idle and wakes on
  the next request (a ~1-2s cold start), which keeps this cheap/likely
  within Fly's free allowance for a personal app. If that cold start ever
  bothers you, flip `auto_stop_machines` to `"off"` and
  `min_machines_running` to `1` in `fly.toml` and redeploy — it'll stay
  on continuously instead (small ongoing cost).
- Schema migrations run automatically on every boot (`MIGRATIONS_DIR`),
  so future `fly deploy`s with new migrations just work — no manual step.
- If you ever need to check in on the server: `fly logs`, `fly status`,
  `fly ssh console`.
