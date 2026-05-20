# Zipline — Bedrock Edition Add-On

A Bedrock port of the "Zipline by Lubcubs" Java datapack. Targets Minecraft Bedrock **1.21+**, uses the stable `@minecraft/server` Script API (no beta APIs, no `@minecraft/server-admin`), and is Marketplace / Realms compatible.

## Layout

```
zipline-bedrock/
├── zipline_BP/        # behavior pack: items, entity, recipes, scripts
│   ├── manifest.json
│   ├── items/         # zipline:placer, zipline:wrench, zipline:handle
│   ├── entities/      # zipline:anchor (invisible marker)
│   ├── recipes/       # crafting recipes for the three items
│   ├── scripts/main.js
│   └── texts/
└── zipline_RP/        # resource pack: textures, item icon mapping
    ├── manifest.json
    ├── textures/
    │   ├── item_texture.json
    │   └── items/{zipline_placer,zipline_wrench,zipline_handle}.png
    └── texts/
```

Textures are reused from the original Java resource pack (`../zipline-rp`). Items currently render as flat icons; if you want the original 3D in-hand look you'll need to add Bedrock **attachables** with custom geometry (the Java Blockbench models don't apply on Bedrock).

## Install

### Single-player / local

1. Locate the `com.mojang` folder:
   - **Windows:** `%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\`
   - **iOS / Android / Console:** package & import via `.mcaddon` (see below).
2. Copy `zipline_BP` into `development_behavior_packs/` and `zipline_RP` into `development_resource_packs/`.
3. In the world's settings → Behavior Packs / Resource Packs, activate both.
4. World requirements:
   - **Beta APIs:** OFF (we only use stable APIs).
   - **Holiday Creator Features:** OFF (not required).
   - Cheats may be left ON or OFF.

### Packaging as `.mcaddon`

```
./build.sh
```

Produces `dist/zipline_BP.mcpack`, `dist/zipline_RP.mcpack`, and `dist/zipline.mcaddon`. Open the `.mcaddon` on the device and it imports both packs in one tap.

### Deploying on Bedrock Dedicated Server (BDS)

```
./deploy-bds.sh /opt/bedrock my_world
```

The first argument is the BDS root (the directory containing `bedrock_server`), the second is the world folder name under `worlds/`. The script copies both packs into `behavior_packs/` and `resource_packs/`, then merges entries into `worlds/<world>/world_behavior_packs.json` and `world_resource_packs.json` — preserving any other add-ons you already had.

If your BDS lives on another host, `scp` the `zipline-bedrock/` directory there first and run the script on the box, or use `sshfs` to mount the BDS root locally.

Recommended `server.properties` change: `texturepack-required=true` so clients are forced to download the RP before joining. Without it, players see the items but no custom textures, geometry, or particles.

Realms is **not** supported — Realms only accepts Marketplace add-ons.

### Uninstalling from BDS

```
./uninstall-bds.sh /opt/bedrock my_world
```

Stop the server first. The script strips the pack UUIDs from the world's `world_{behavior,resource}_packs.json` and removes any `zipline_BP_*` / `zipline_RP_*` directories from `behavior_packs/` and `resource_packs/`. Idempotent.

Any `zipline:anchor` entities already in the world become inert ghosts (they persist in world data but don't render or tick). To purge them, run `/kill @e[type=zipline:anchor]` in-game **before** uninstalling, while the add-on is still loaded.

## How to play

| Item | Action | Effect |
|---|---|---|
| **Zipline Spool** (`zipline:placer`) | **Use** (no pending) | Sets the line start anchor where you're aiming. Shows a live preview. |
| **Zipline Spool** | **Use** (after start set) | Finishes the line to where you're aiming (up to 96 segments). |
| **Zipline Wrench** (`zipline:wrench`) | **Use** while aiming at a wire | Removes the entire line and drops 7 iron ingots. |
| **Zipline Wrench** | **Use** with a pending placement | Cancels the pending line, removes the orphaned start anchor. |
| **Zipline Handle** (`zipline:handle`) | **Use** while aiming at a wire | Mounts the line. You travel segment-by-segment with slow-falling. |
| (any item) | **Sneak** while riding | Dismount (after a ~0.5s grace window from mount). |
| (any item) | Swap to a different hotbar slot while riding | Auto-dismount. |

Lines can be up to 96 blocks long. Anchors are spaced 1 block apart (96 max). Ride speed is ~20 blocks/second. Each player can have **up to 20 lines** active at once.

While placing, the action bar shows the current pending distance. While riding, it shows the current segment / total.

Crafting:
- Spool: 8 iron ingots around a lead (shaped, crafting table).
- Wrench: 2 iron + 2 redstone (shaped).
- Handle: 3 iron + 2 tripwire hooks + 1 iron (shaped).

(Edit `zipline_BP/recipes/*.json` to taste.)

## Manual test plan

1. **Load** — Create a flat creative world with both packs active, no experiments toggled.
2. **Spawn items** — `/give @s zipline:placer`, `/give @s zipline:wrench`, `/give @s zipline:handle`.
3. **Place** — Stand on a tower, sneak + use the spool aiming at empty air → "start set" message. Walk to a second tower, aim at empty air, use the spool again → "Zipline created" with segment count.
4. **Ride** — Aim at a visible part of the line, use the handle → you should travel along it with levitation. Verify dismount when you reach the end.
5. **Re-mount mid-line** — Walk under a placed line, aim at it, use handle → starts riding from that anchor.
6. **Remove** — Aim at any anchor on a line, use the wrench → whole line disappears, 7 iron drop.
7. **Edge cases**
   - Try to finish a line shorter than 1.5 blocks → "too short" rejection.
   - Sneak + use the spool again while a pending start exists → resets to the new spot (current behavior overwrites).
   - Log out and back in while riding → ride state clears safely.
   - Multiple players, separate lines → state is per-player (dynamic properties on the player) and per-line (dynamic properties on anchors), no crosstalk.
8. **Uninstall** — Removing the packs from the world cleanly stops the script. Any leftover anchor entities can be removed with `/kill @e[type=zipline:anchor]`.
9. **Recipe-book sanity check** — In a creative world with the required materials (iron, lead, redstone, tripwire hook) in your inventory, open the recipe book. The three zipline recipes should appear.
10. **Admin cleanup** — Manually destroy a start anchor (`/kill` on one), then run `/scriptevent zipline:cleanup`. The orphaned segments are removed and the operator gets a count message.
11. **Cancel placement** — Sneak + use the spool to start a line, then sneak + use the wrench. The pending state clears, the orphan start anchor disappears, you hear a confirmation sound.
12. **Survive falling** — Ride to the end of a high line. You should land with slow-falling, taking no fall damage.
13. **Death cleanup** — Start a ride, `/kill @s`. After respawning you should have no leftover levitation effect.

## Known limits / non-goals

- 3D in-hand models are wired up via attachables (`zipline_RP/attachables/`, `models/entity/`, `animations/zipline.animation.json`). The inventory icon stays 2D — Bedrock only renders attachables when the item is equipped, by design. **Hold poses are placeholders** — see "Tuning the in-hand pose" below.
- The wire is drawn with custom dark-grey particles (`zipline:rope`) interpolated between anchors every 2 ticks within 48 blocks of any player. The **start** of each line gets a tall green column (`zipline:anchor_start`); the **end** gets a red column (`zipline:anchor_end`). While placing, a live grey trail (`zipline:preview`) shows the line you're about to commit.
- Inventory icons for the wrench and handle are placeholder programmer-art silhouettes. To upgrade them: open the matching `.geo.json` in Blockbench → File → Export → **Inventory Render** (or use the model viewport screenshot) → save as `zipline_RP/textures/items/zipline_{wrench,handle}.png` at 32×32. The 3D in-hand model is unaffected (it uses `zipline_cable.png`).
- The Java pack detected "crafting" via floating-item collision; this port uses normal crafting recipes instead (more reliable).
- Anchors are persistent entities. If chunks unload mid-ride the next-anchor lookup may fail and the player dismounts gracefully.

## Tuning the in-hand pose

The first/third person hold poses live in `zipline_RP/animations/zipline.animation.json`. Each item has two clips (`hold_first_person`, `hold_third_person`). The placeholder values are unlikely to look right out of the box — expect to iterate.

Iteration loop:

1. Edit the `rotation` (degrees, XYZ) and `position` (pixels, XYZ) of the `bb_main` bone for the clip you want to fix.
2. In-game, reload the resource pack: `Settings → Resource Packs → Zipline RP → re-toggle`, or `/reload` if cheats are on.
3. Hold the item in main hand. Check first-person view (default), then F5 for third-person.
4. Repeat. Typical good starting ranges:
   - **Third person**: `rotation [-90, 0, 0]` makes a long item lie flat in the hand; tweak the third axis to face it forward.
   - **First person**: rotate by `-90` on Y to point the item away from the camera, then translate +Z (away) and +X (right) to push it out of the face.

If a face renders magenta, the texture path in the attachable is wrong (omit `.png`, root relative). If the whole model is invisible, the geometry identifier doesn't match — verify `geometry.zipline.<name>` matches between attachable JSON and `.geo.json`.

## Admin commands

| Command | Effect |
|---|---|
| `/scriptevent zipline:cleanup` | Removes any anchor whose start anchor (segment 0) is missing — i.e. orphans from manually killed entities or partially failed placements. Reports the count to whoever ran it. |

## Reliability notes (vs. the Java original)

- **No `@p`-inside-`@e` bug:** every action is tied to a specific player passed through the event.
- **No 20-segment hard cap unrolled by hand** — `MAX_SEGMENTS = 96`.
- **No `forceload` leak:** Bedrock chunks don't need it; anchors are persistent.
- **Death + dimension-change cleanup:** ride state cleared automatically.
- **Slow-falling on dismount:** no surprise fall damage at line ends.
- **Per-player line cap (20):** prevents griefer-driven entity sprawl.
- **Top-level error wrapping:** one bad event doesn't disable the whole script.
- **`/scriptevent zipline:cleanup`:** drop-in admin tool to sweep orphans.
- **Stable APIs only** — no beta gates, no `server-admin`, Marketplace-compatible.
