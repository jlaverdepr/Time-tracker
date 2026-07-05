import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "..");
const outdir = path.join(root, "dist-main");

const channel = process.env.APP_CHANNEL === "beta" ? "beta" : "stable";

await rm(outdir, { recursive: true, force: true });

await build({
  entryPoints: [path.join(root, "src/main.ts")],
  outdir,
  platform: "node",
  bundle: true,
  format: "cjs",
  target: "node20",
  external: ["electron", "better-sqlite3"],
  sourcemap: true,
  logLevel: "info",
  define: {
    "process.env.APP_CHANNEL": JSON.stringify(channel),
  },
});
