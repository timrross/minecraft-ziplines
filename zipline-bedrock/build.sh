#!/usr/bin/env bash
# Build .mcpack + .mcaddon artifacts for the Zipline add-on.
# Usage: ./build.sh  →  produces zipline_BP_v<ver>.mcpack, zipline_RP_v<ver>.mcpack, zipline_v<ver>.mcaddon
# The version is read from zipline_BP/manifest.json so the filename always
# matches the build you're importing.
set -euo pipefail

cd "$(dirname "$0")"

VERSION="$(node -e "process.stdout.write(require('./zipline_BP/manifest.json').header.version.join('.'))")"

DIST="dist"
rm -rf "$DIST"
mkdir -p "$DIST"

BP_PACK="$DIST/zipline_BP_v$VERSION.mcpack"
RP_PACK="$DIST/zipline_RP_v$VERSION.mcpack"
ADDON="$DIST/zipline_v$VERSION.mcaddon"

ZIP_OPTS=(-rq -X)
EXCLUDES=("*.DS_Store" "*/.DS_Store")

zip_pack() {
  local src="$1" dest="$2"
  ( cd "$src" && zip "${ZIP_OPTS[@]}" "../$dest" . -x "${EXCLUDES[@]}" )
}

zip_pack zipline_BP "$BP_PACK"
zip_pack zipline_RP "$RP_PACK"

( cd "$DIST" && zip "${ZIP_OPTS[@]}" "$(basename "$ADDON")" "$(basename "$BP_PACK")" "$(basename "$RP_PACK")" )

echo "Built v$VERSION:"
echo "  $BP_PACK"
echo "  $RP_PACK"
echo "  $ADDON"
