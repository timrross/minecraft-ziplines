#!/usr/bin/env bash
# Deploy the Zipline add-on into a Bedrock Dedicated Server install.
#
# Usage: ./deploy-bds.sh <bds_root> <world_name>
#   bds_root    – path to the directory containing bedrock_server (e.g. /opt/bedrock)
#   world_name  – the world folder name under <bds_root>/worlds/
#
# Run on the BDS host (or sshfs/scp the files there first). Idempotent — safe to
# re-run; merges into existing world_{behavior,resource}_packs.json without
# duplicating entries.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <bds_root> <world_name>" >&2
  exit 2
fi

BDS_ROOT="$1"
WORLD="$2"

BP_UUID="c74cdcb9-d41a-4c3b-9774-3b1682f2d2d0"
RP_UUID="ab9c628b-d5e9-4550-b79d-837794fd6378"
VERSION="1.0.0"
BP_DIR_NAME="zipline_BP_${VERSION}"
RP_DIR_NAME="zipline_RP_${VERSION}"

WORLD_DIR="$BDS_ROOT/worlds/$WORLD"
BP_DEST="$BDS_ROOT/behavior_packs/$BP_DIR_NAME"
RP_DEST="$BDS_ROOT/resource_packs/$RP_DIR_NAME"

[[ -d "$BDS_ROOT" ]] || { echo "BDS root not found: $BDS_ROOT" >&2; exit 1; }
[[ -d "$WORLD_DIR" ]] || { echo "World not found: $WORLD_DIR" >&2; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
BP_SRC="$HERE/zipline_BP"
RP_SRC="$HERE/zipline_RP"

mkdir -p "$BDS_ROOT/behavior_packs" "$BDS_ROOT/resource_packs"

echo "Copying behavior pack → $BP_DEST"
rm -rf "$BP_DEST"
cp -R "$BP_SRC" "$BP_DEST"

echo "Copying resource pack → $RP_DEST"
rm -rf "$RP_DEST"
cp -R "$RP_SRC" "$RP_DEST"

merge_pack() {
  local file="$1" uuid="$2" version_csv="$3"
  python3 - "$file" "$uuid" "$version_csv" <<'PY'
import json, os, sys
path, uuid, ver_csv = sys.argv[1], sys.argv[2], sys.argv[3]
version = [int(x) for x in ver_csv.split(",")]
data = []
if os.path.exists(path):
    with open(path) as f:
        try: data = json.load(f)
        except json.JSONDecodeError: data = []
seen = False
for e in data:
    if e.get("pack_id") == uuid:
        e["version"] = version
        seen = True
        break
if not seen:
    data.append({"pack_id": uuid, "version": version})
with open(path, "w") as f:
    json.dump(data, f, indent=2)
print(f"  wrote {path} ({len(data)} packs)")
PY
}

echo "Updating $WORLD_DIR/world_behavior_packs.json"
merge_pack "$WORLD_DIR/world_behavior_packs.json" "$BP_UUID" "1,0,0"

echo "Updating $WORLD_DIR/world_resource_packs.json"
merge_pack "$WORLD_DIR/world_resource_packs.json" "$RP_UUID" "1,0,0"

cat <<DONE

Done. Next steps:

  1. (Recommended) Set in $BDS_ROOT/server.properties:
       texturepack-required=true
     so clients must download the RP before joining.

  2. Restart the server. On next connect each client will be prompted to
     download the resource pack.

  3. In-game, try /give @s zipline:placer to confirm the pack loaded.

To update later: bump 'version' in both zipline_{BP,RP}/manifest.json,
re-run build.sh, then re-run this script. Clients will re-download.
DONE
