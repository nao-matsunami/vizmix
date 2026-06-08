/**
 * electron-builder afterPack hook — ad-hoc sign the packaged macOS app.
 *
 * Why: the universal (arm64 + x64) bundle is produced by lipo-merging two
 * per-arch builds. With `identity: null` electron-builder skips signing, which
 * leaves the merged bundle internally inconsistent (Sealed Resources=none,
 * Info.plist not bound). On Apple Silicon macOS refuses to launch such a
 * bundle ("VizMix is damaged"). A deep ad-hoc signature (`codesign -s -`) makes
 * the bundle valid and launchable.
 *
 * This is NOT Apple code signing. There is no Developer ID and no notarization
 * (those come later — see the distribution doc / §5). Gatekeeper still flags the
 * app as from an "unidentified developer"; users open it once via right-click →
 * Open. Ad-hoc signing is free and runs locally on the build Mac.
 *
 * No-op on Windows / Linux.
 */
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  // Universal builds pack each arch into a *-temp dir first, then lipo-merge
  // them. @electron/universal requires the two per-arch bundles to be byte
  // identical (apart from binaries), so signing the temps breaks the merge.
  // Only sign the final merged bundle.
  if (context.appOutDir.includes("-temp")) return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  // --deep re-signs every nested helper/framework; --force replaces the
  // linker-only ad-hoc signature with a sealed bundle signature.
  execFileSync("codesign", ["--deep", "--force", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  console.log(`  • ad-hoc signed (free, local — not Apple): ${appPath}`);
};
