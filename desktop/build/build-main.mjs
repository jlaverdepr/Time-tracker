import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm, copyFile } from "node:fs/promises";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "..");
const outdir = path.join(root, "dist-main");

const channel = process.env.APP_CHANNEL === "beta" ? "beta" : "stable";

await rm(outdir, { recursive: true, force: true });

await build({
  entryPoints: [
    path.join(root, "src/main.ts"),
    path.join(root, "src/setup-preload.ts"),
  ],
  outdir,
  platform: "node",
  bundle: true,
  format: "cjs",
  target: "node20",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
  define: {
    "process.env.APP_CHANNEL": JSON.stringify(channel),
  },
});

// Not bundled JS — just needs to sit alongside main.js so main.ts's
// __dirname-relative resourcePath() can find it in both dev and packaged
// (asar) builds.
await copyFile(
  path.join(root, "src/setup.html"),
  path.join(outdir, "setup.html"),
);
