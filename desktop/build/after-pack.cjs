const { execFileSync } = require("node:child_process");
const path = require("node:path");

// electron-builder skips real signing when no Developer ID certificate is
// present (expected for a personal, locally-built app), but the packed
// Electron.app retains its original ad-hoc signature, which only covers
// Electron's own files. Adding our resources (asar, extraResources)
// invalidates that signature, causing macOS to refuse to launch it. Re-sign
// ad-hoc after packing so the final bundle (including the .dmg, which is
// built from this same appOutDir) has a valid, self-consistent signature.
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  execFileSync("codesign", ["--deep", "--force", "--sign", "-", appPath]);
};
