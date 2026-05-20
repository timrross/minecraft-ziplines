#!/usr/bin/env bash
# Build .mcpack + .mcaddon artifacts for the Zipline add-on.
# Usage: ./build.sh  →  produces zipline_BP.mcpack, zipline_RP.mcpack, zipline.mcaddon
set -euo pipefail

cd "$(dirname "$0")"

DIST="dist"
rm -rf "$DIST"
mkdir -p "$DIST"

BP_PACK="$DIST/zipline_BP.mcpack"
RP_PACK="$DIST/zipline_RP.mcpack"
ADDON="$DIST/zipline.mcaddon"

ZIP_OPTS=(-rq -X)
EXCLUDES=("*.DS_Store" "*/.DS_Store")

zip_pack() {
  local src="$1" dest="$2"
  ( cd "$src" && zip "${ZIP_OPTS[@]}" "../$dest" . -x "${EXCLUDES[@]}" )
}

zip_pack zipline_BP "$BP_PACK"
zip_pack zipline_RP "$RP_PACK"

( cd "$DIST" && zip "${ZIP_OPTS[@]}" "$(basename "$ADDON")" "$(basename "$BP_PACK")" "$(basename "$RP_PACK")" )

echo "Built:"
echo "  $BP_PACK"
echo "  $RP_PACK"
echo "  $ADDON"
