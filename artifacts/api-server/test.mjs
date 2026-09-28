// Bundles src/**/*.test.ts with esbuild (workspace packages are TS source)
// and runs them with node:test against a throwaway SQLite database.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { rmSync, readdirSync } from "node:fs";
import { build } from "esbuild";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const tests = readdirSync(path.join(artifactDir, "src"), { recursive: true })
  .filter(f => f.endsWith(".test.ts"))
  .map(f => path.join(artifactDir, "src", f));

// Inside the package so the bundle resolves better-sqlite3 from its node_modules.
const outdir = path.join(artifactDir, "node_modules/.cache/api-tests");
rmSync(outdir, { recursive: true, force: true });
await build({
  entryPoints: tests,
  outdir,
  platform: "node",
  bundle: true,
  format: "esm",
  outExtension: { ".js": ".mjs" },
  external: ["better-sqlite3"],
  logLevel: "warning",
});

const outputs = readdirSync(outdir).filter(f => f.endsWith(".mjs")).map(f => path.join(outdir, f));
const { status } = spawnSync(process.execPath, ["--test", ...outputs], {
  cwd: artifactDir,
  stdio: "inherit",
  env: { ...process.env, DB_PATH: path.join(outdir, "test.sqlite") },
});
process.exit(status ?? 1);
