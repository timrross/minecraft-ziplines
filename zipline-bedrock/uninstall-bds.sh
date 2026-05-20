#!/usr/bin/env bash
# Uninstall the Zipline add-on from a Bedrock Dedicated Server install.
#
# Usage: ./uninstall-bds.sh <bds_root> <world_name>
#   bds_root    – path to the directory containing bedrock_server (or /data
#                 inside an itzg container; for itzg use the host bind-mount)
#   world_name  – the world folder name under <bds_root>/worlds/
#
# Stop BDS first (docker compose stop bedrock, or systemctl stop bedrock).
# Idempotent — safe to re-run. Removes any zipline_BP_* and zipline_RP_* dirs
# and strips the pack UUIDs from world_{behavior,resource}_packs.json.
#
# Note: any zipline:anchor entities already placed in your world will remain
# as inert "ghost" entities (no script, no rendering). To purge them, run
# /kill @e[type=zipline:anchor] in-game BEFORE uninstalling (while the
# add-on is still loaded).
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <bds_root> <world_name>" >&2
  exit 2
fi

BDS_ROOT="$1"
WORLD="$2"

BP_UUID="c74cdcb9-d41a-4c3b-9774-3b1682f2d2d0"
RP_UUID="ab9c628b-d5e9-4550-b79d-837794fd6378"

WORLD_DIR="$BDS_ROOT/worlds/$WORLD"

[[ -d "$BDS_ROOT" ]] || { echo "BDS root not found: $BDS_ROOT" >&2; exit 1; }
[[ -d "$WORLD_DIR" ]] || { echo "World not found: $WORLD_DIR" >&2; exit 1; }

strip_uuid() {
  local file="$1" uuid="$2"
  if [[ ! -f "$file" ]]; then
    echo "  (no $file to update)"
    return
  fi
  python3 - "$file" "$uuid" <<'PY'
import json, sys
path, uuid = sys.argv[1], sys.argv[2]
with open(path) as f:
    try: data = json.load(f)
    except json.JSONDecodeError: data = []
before = len(data)
data = [e for e in data if e.get("pack_id") != uuid]
with open(path, "w") as f:
    json.dump(data, f, indent=2)
print(f"  {path}: {before} entries -> {len(data)}")
PY
}

echo "Stripping pack references from world JSON…"
strip_uuid "$WORLD_DIR/world_behavior_packs.json" "$BP_UUID"
strip_uuid "$WORLD_DIR/world_resource_packs.json" "$RP_UUID"

echo "Removing pack directories…"
shopt -s nullglob
removed_any=false
for d in "$BDS_ROOT"/behavior_packs/zipline_BP_* "$BDS_ROOT"/resource_packs/zipline_RP_*; do
  if [[ -d "$d" ]]; then
    rm -rf "$d"
    echo "  rm -rf $d"
    removed_any=true
  fi
done
if ! $removed_any; then
  echo "  (no zipline_BP_* / zipline_RP_* dirs found)"
fi

cat <<DONE

Done. Restart the server (docker compose up -d bedrock, or systemctl start bedrock).

Reminder: any zipline:anchor entities already in the world are now inert ghosts.
They don't render or tick, but they persist in world data. To purge them, you'd
need to reinstall the add-on briefly, log in, run /kill @e[type=zipline:anchor],
then uninstall again.
DONE
