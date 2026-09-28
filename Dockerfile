# Builds and runs the FocusTime API server (+ the desktop app's web UI,
# served from the same origin) as a standalone always-on deployment — no
# Electron involved. See DEPLOY.md for the full setup runbook.
#
# This copies the whole pnpm workspace and installs everything in one stage
# (rather than trying to hand-pick node_modules across build stages) because
# pnpm's workspace symlinks only resolve correctly if the on-disk directory
# layout stays intact end to end. Costs image size, buys reliability.
FROM node:22-bookworm-slim

# python3/make/g++ back node-gyp in case no prebuilt better-sqlite3 binary
# matches this exact platform.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10

WORKDIR /repo
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build
RUN pnpm --filter @workspace/time-tracker run build

ENV NODE_ENV=production
ENV MIGRATIONS_DIR=/repo/lib/db/drizzle
ENV STATIC_DIR=/repo/artifacts/time-tracker/dist/public
ENV PORT=8080

EXPOSE 8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
