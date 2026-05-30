import { world, system, ItemStack, EquipmentSlot, EntityDamageCause } from "@minecraft/server";

const PLACER = "zipline:placer";
const WRENCH = "zipline:wrench";
const HANDLE = "zipline:handle";
const ANCHOR = "zipline:anchor";
const CABLE = "zipline:cable";
const TROLLEY = "zipline:trolley";

const MAX_LINE_BLOCKS = 144;
const SEGMENT_BLOCKS = 1.0;
const MAX_SEGMENTS = 144;
// The cable visual is rendered as a chain of short entities rather than one long
// stretched one: Bedrock culls an entity by the distance from the camera to its
// origin (not its stretched geometry), so a single line-long cable vanishes once
// you ride far from the start anchor. Chunking keeps every visible piece's origin
// close to the camera. Smaller = fewer gaps but more entities.
const CABLE_CHUNK_BLOCKS = 16;
const MIN_LINE_LENGTH = 2.0;
const AIM_RADIUS = 7;
const AIM_PERP_TOLERANCE = 1.6;
const MOUNT_NEAREST_RADIUS = 2.5;
// How close the sighted line's nearest point must be to hook on by aiming. You
// can pick a line by looking at it from a little way off, but not mount one
// clear across the room — keep it close, just a touch more than the no-aim
// nearest radius so aiming buys a bit of reach without teleporting you far.
const MOUNT_AIM_RADIUS = 4;
const RIDE_TICK_INTERVAL = 1;
const RIDE_LOOKAHEAD = 4;
const RIDE_HANG_OFFSET = 2.0; // blocks the player hangs below the wire
// Speed model: target speed depends on the line's slope (downhill = faster),
// and the rider's actual speed lerps toward the target so motion ramps in
// instead of snapping. Tune these in playtest.
const RIDE_SPEED_BASE = 0.4;  // blocks/tick on a flat line (~8 b/s at 20 tps)
const RIDE_SPEED_MIN  = 0.05; // creep on steep uphills (so you don't freeze)
const RIDE_SPEED_MAX  = 0.8;  // terminal velocity on steep downhills
const RIDE_SLOPE_GAIN = 2.0;  // how much slope multiplies the base speed
const RIDE_ACCEL      = 0.10; // per-tick lerp factor toward target speed
const RIDE_SOUND_INTERVAL = 10; // ticks between re-triggering the ride sound
const DISMOUNT_MOMENTUM_GAIN = 2.0; // multiplier on speed when carrying forward off the line
const DISMOUNT_VERTICAL_LIFT = 0.1; // small upward kick so you don't drop straight on dismount
const RIDE_COLLISION_GRACE_TICKS = 5;             // ignore collisions for the first few ticks after mount
const RIDE_BLOCK_LOOKAHEAD = RIDE_SPEED_MAX + 0.5; // sized for the fastest the ride can go
const RIDE_MOB_RADIUS = 1.2;                    // sphere around trolley to check for mobs/players
const RIDE_HEAD_OFFSET = 1.8;                   // rider head height above trolley
const KNOCKBACK_HORIZ = 0.8;
const KNOCKBACK_VERT = 0.4;
const KNOCKBACK_DAMAGE = 3;
const COLLISION_PARTICLE = "minecraft:critical_hit_emitter";

const RIDE_SLOWFALL_TICKS = 40;
const DISMOUNT_SLOWFALL_TICKS = 60;
const DISMOUNT_SLOWFALL_AMPLIFIER = 4;
const MOUNT_GRACE_TICKS = 10;

const PREVIEW_INTERVAL_TICKS = 2;

const MAX_LINES_PER_PLAYER = 20;
const DIMENSION_IDS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

const DP_LINE_ID = "zipline:lineId";
const DP_SEG_INDEX = "zipline:segIndex";
const DP_SEG_COUNT = "zipline:segCount";
const DP_CREATOR_ID = "zipline:creatorId";
const DP_PENDING_LINE = "zipline:pendingLine";
const DP_PENDING_ANCHOR = "zipline:pendingAnchor";
const DP_RIDING_LINE = "zipline:ridingLine";
const DP_RIDING_SEG = "zipline:ridingSeg";
const DP_RIDING_COUNT = "zipline:ridingCount";
const DP_MOUNT_TICK = "zipline:mountTick";
const DP_RIDING_TROLLEY = "zipline:ridingTrolley";
const DP_RIDING_DIR = "zipline:ridingDir";       // +1 (start->end) or -1 (end->start)
const DP_RIDING_SPEED = "zipline:ridingSpeed";   // current speed in blocks/tick (ramps)
const DP_RIDING_LAST_DX = "zipline:lastDx";      // last per-tick travel dx (carried out on dismount)
const DP_RIDING_LAST_DZ = "zipline:lastDz";
const DP_LINE_SLOPE = "zipline:lineSlope";       // cached on the start anchor; -dy/horiz (down +ve)
const DP_LINE_DIR_X = "zipline:lineDirX";        // cached on start anchor; end - start (unnormalized)
const DP_LINE_DIR_Y = "zipline:lineDirY";
const DP_LINE_DIR_Z = "zipline:lineDirZ";
const DP_PREVIEW_CABLE = "zipline:previewCable";
const DP_PREVIEW = "zipline:isPreview";

function safe(fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (e) {
      console.warn("[zipline]", e, e?.stack ?? "");
    }
  };
}

function newLineId() {
  return "L" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function distance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getMainhand(player) {
  const eq = player.getComponent("minecraft:equippable");
  return eq?.getEquipment(EquipmentSlot.Mainhand);
}

function raycastEnd(player) {
  const dim = player.dimension;
  const origin = player.getHeadLocation();
  const dir = player.getViewDirection();
  const hit = dim.getBlockFromRay(origin, dir, {
    maxDistance: MAX_LINE_BLOCKS,
    includeLiquidBlocks: false,
    includePassableBlocks: true,
  });
  if (hit?.block) {
    const b = hit.block.location;
    return { x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 };
  }
  return {
    x: origin.x + dir.x * MAX_LINE_BLOCKS,
    y: origin.y + dir.y * MAX_LINE_BLOCKS,
    z: origin.z + dir.z * MAX_LINE_BLOCKS,
  };
}

function findAimedAnchor(player) {
  const dim = player.dimension;
  const origin = player.getHeadLocation();
  const dir = player.getViewDirection();
  const candidates = dim.getEntities({
    type: ANCHOR,
    location: origin,
    maxDistance: AIM_RADIUS,
  });
  // Among anchors whose distance from the crosshair ray is within tolerance,
  // pick the one best ALIGNED with the view (largest cos angle), not the one
  // nearest along the ray. When several lines share an anchor and fan out in
  // different directions, the nearest-along-ray anchor sits at the shared point
  // and could belong to any line; the best-aligned anchor lies farther down the
  // exact line the player is sighting, so it disambiguates which line they mean.
  let best = null;
  let bestAlign = -Infinity;
  for (const a of candidates) {
    const dx = a.location.x - origin.x;
    const dy = a.location.y - origin.y;
    const dz = a.location.z - origin.z;
    const t = dx * dir.x + dy * dir.y + dz * dir.z;
    if (t <= 0 || t > AIM_RADIUS) continue;
    const px = dx - dir.x * t;
    const py = dy - dir.y * t;
    const pz = dz - dir.z * t;
    const perp = Math.sqrt(px * px + py * py + pz * pz);
    if (perp >= AIM_PERP_TOLERANCE) continue;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const align = dist > 0 ? t / dist : 0; // cos of angle to crosshair; ~1 = dead-on
    if (align > bestAlign) {
      best = a;
      bestAlign = align;
    }
  }
  return best;
}

// Fallback for mounting: the closest anchor within a small radius of the
// player, regardless of where they're looking. Makes "hook onto the wire
// I'm standing next to" forgiving when precise aim at the thin cable fails.
function findNearestAnchor(player, radius) {
  const origin = player.getHeadLocation();
  const candidates = player.dimension.getEntities({
    type: ANCHOR,
    location: origin,
    maxDistance: radius,
  });
  let best = null;
  let bestD = Infinity;
  for (const a of candidates) {
    const d = distance(a.location, origin);
    if (d < bestD) {
      best = a;
      bestD = d;
    }
  }
  return best;
}

// The closest anchor belonging to a specific line. Used at mount time so that,
// once the view has chosen WHICH line to ride, the player is seated at the
// nearest point of that line rather than wherever the aim-pick anchor happened
// to land farther down the cable.
function findNearestAnchorOnLine(player, lineId, radius) {
  const origin = player.getHeadLocation();
  const candidates = player.dimension.getEntities({
    type: ANCHOR,
    location: origin,
    maxDistance: radius,
  });
  let best = null;
  let bestD = Infinity;
  for (const a of candidates) {
    if (a.getDynamicProperty(DP_LINE_ID) !== lineId) continue;
    const d = distance(a.location, origin);
    if (d < bestD) {
      best = a;
      bestD = d;
    }
  }
  return best;
}

function findAnchorById(dim, anchorId, near) {
  const anchors = dim.getEntities({
    type: ANCHOR,
    location: near,
    maxDistance: MAX_LINE_BLOCKS + 16,
  });
  return anchors.find((e) => e.id === anchorId) ?? null;
}

function findCableById(dim, cableId, near) {
  if (typeof cableId !== "string") return null;
  const cables = dim.getEntities({
    type: CABLE,
    location: near,
    maxDistance: MAX_LINE_BLOCKS + 16,
  });
  return cables.find((e) => e.id === cableId) ?? null;
}

function findTrolleyById(dim, trolleyId, near) {
  if (typeof trolleyId !== "string") return null;
  const trolleys = dim.getEntities({
    type: TROLLEY,
    location: near,
    maxDistance: MAX_LINE_BLOCKS + 16,
  });
  return trolleys.find((e) => e.id === trolleyId) ?? null;
}

// Point the cable from startLoc toward endLoc and stretch it to fit. yaw/pitch
// use Minecraft's convention (yaw 0 = +Z); the geometry/animation map them onto
// the bar. Shared by committed lines and the live placement preview.
function setCableTransform(cable, startLoc, endLoc) {
  const dx = endLoc.x - startLoc.x;
  const dy = endLoc.y - startLoc.y;
  const dz = endLoc.z - startLoc.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const horiz = Math.sqrt(dx * dx + dz * dz);
  const yaw = (Math.atan2(-dx, dz) * 180) / Math.PI;
  const pitch = (Math.atan2(-dy, horiz) * 180) / Math.PI;
  try {
    cable.setProperty("zipline:length", Math.max(0.01, Math.min(144, dist)));
    cable.setProperty("zipline:yaw", yaw);
    cable.setProperty("zipline:pitch", pitch);
  } catch (_) {}
}

function removePreviewCable(player) {
  const id = player.getDynamicProperty(DP_PREVIEW_CABLE);
  const c = findCableById(player.dimension, id, player.location);
  if (c) {
    try { c.remove(); } catch (_) {}
  }
  player.setDynamicProperty(DP_PREVIEW_CABLE, undefined);
}

function clearPending(player) {
  removePreviewCable(player);
  player.setDynamicProperty(DP_PENDING_LINE, undefined);
  player.setDynamicProperty(DP_PENDING_ANCHOR, undefined);
}

function countLinesByCreator(creatorId) {
  let n = 0;
  for (const dimId of DIMENSION_IDS) {
    const dim = world.getDimension(dimId);
    const anchors = dim.getEntities({ type: ANCHOR });
    for (const a of anchors) {
      if (
        a.getDynamicProperty(DP_SEG_INDEX) === 0 &&
        a.getDynamicProperty(DP_CREATOR_ID) === creatorId
      ) {
        if (++n >= MAX_LINES_PER_PLAYER) return n;
      }
    }
  }
  return n;
}

function placeStartAnchor(player) {
  if (countLinesByCreator(player.id) >= MAX_LINES_PER_PLAYER) {
    player.sendMessage(`§cZipline limit reached (${MAX_LINES_PER_PLAYER}). Remove one first.`);
    player.playSound("note.bass", { volume: 0.5, pitch: 0.7 });
    return;
  }
  const end = raycastEnd(player);
  const lineId = newLineId();
  const anchor = player.dimension.spawnEntity(ANCHOR, end);
  anchor.setDynamicProperty(DP_LINE_ID, lineId);
  anchor.setDynamicProperty(DP_SEG_INDEX, 0);
  anchor.setDynamicProperty(DP_CREATOR_ID, player.id);
  player.setDynamicProperty(DP_PENDING_LINE, lineId);
  player.setDynamicProperty(DP_PENDING_ANCHOR, anchor.id);
  player.sendMessage("§aZipline start set. Use the spool again to finish.");
  player.playSound("note.bell", { volume: 0.6, pitch: 1.4 });
}

// Spawn the single rigid cable entity for a line. The cable geometry is a
// 1-block bar along +Z; we stretch it to the line length and rotate it to
// point start -> end via client-synced entity properties (applied in the
// cable animation). yaw/pitch use Minecraft's convention (yaw 0 = +Z).
function spawnCable(dim, lineId, startLoc, endLoc) {
  const dx = endLoc.x - startLoc.x;
  const dy = endLoc.y - startLoc.y;
  const dz = endLoc.z - startLoc.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const chunks = Math.max(1, Math.ceil(dist / CABLE_CHUNK_BLOCKS));
  for (let i = 0; i < chunks; i++) {
    const a = {
      x: startLoc.x + dx * (i / chunks),
      y: startLoc.y + dy * (i / chunks),
      z: startLoc.z + dz * (i / chunks),
    };
    const b = {
      x: startLoc.x + dx * ((i + 1) / chunks),
      y: startLoc.y + dy * ((i + 1) / chunks),
      z: startLoc.z + dz * ((i + 1) / chunks),
    };
    try {
      const cable = dim.spawnEntity(CABLE, a);
      cable.setDynamicProperty(DP_LINE_ID, lineId);
      setCableTransform(cable, a, b);
    } catch (_) {}
  }
}

// Spawn-on-demand ghost cable that tracks the player's aim during placement.
function updatePreviewCable(player, dim, startLoc, endLoc) {
  let cable = findCableById(dim, player.getDynamicProperty(DP_PREVIEW_CABLE), startLoc);
  if (!cable) {
    try {
      cable = dim.spawnEntity(CABLE, startLoc);
      cable.setDynamicProperty(DP_PREVIEW, 1);
      player.setDynamicProperty(DP_PREVIEW_CABLE, cable.id);
    } catch (_) {
      return;
    }
  }
  setCableTransform(cable, startLoc, endLoc);
}

function placeEndAndConnect(player) {
  const lineId = player.getDynamicProperty(DP_PENDING_LINE);
  const startId = player.getDynamicProperty(DP_PENDING_ANCHOR);
  if (typeof lineId !== "string" || typeof startId !== "string") {
    clearPending(player);
    return;
  }
  const dim = player.dimension;
  const startAnchor = findAnchorById(dim, startId, player.location);
  if (!startAnchor) {
    player.sendMessage("§cStart anchor not found — was it unloaded? Reset.");
    clearPending(player);
    return;
  }
  const startLoc = startAnchor.location;
  const endLoc = raycastEnd(player);
  const dist = distance(startLoc, endLoc);
  if (dist < MIN_LINE_LENGTH) {
    player.sendMessage("§cZipline is too short.");
    return;
  }
  const segCount = Math.min(MAX_SEGMENTS, Math.max(2, Math.ceil(dist / SEGMENT_BLOCKS)));
  const stepX = (endLoc.x - startLoc.x) / segCount;
  const stepY = (endLoc.y - startLoc.y) / segCount;
  const stepZ = (endLoc.z - startLoc.z) / segCount;
  for (let i = 1; i <= segCount; i++) {
    const loc = {
      x: startLoc.x + stepX * i,
      y: startLoc.y + stepY * i,
      z: startLoc.z + stepZ * i,
    };
    const a = dim.spawnEntity(ANCHOR, loc);
    a.setDynamicProperty(DP_LINE_ID, lineId);
    a.setDynamicProperty(DP_SEG_INDEX, i);
  }
  spawnCable(dim, lineId, startLoc, endLoc);
  startAnchor.setDynamicProperty(DP_SEG_COUNT, segCount);
  // Cache line direction + slope on the start anchor for the ride logic to read
  // at mount time (so we don't have to scan endpoints every ride).
  {
    const ddx = endLoc.x - startLoc.x;
    const ddy = endLoc.y - startLoc.y;
    const ddz = endLoc.z - startLoc.z;
    const horiz = Math.sqrt(ddx * ddx + ddz * ddz);
    const slope = horiz > 0.0001 ? -ddy / horiz : 0; // +ve downhill (forward)
    startAnchor.setDynamicProperty(DP_LINE_SLOPE, slope);
    startAnchor.setDynamicProperty(DP_LINE_DIR_X, ddx);
    startAnchor.setDynamicProperty(DP_LINE_DIR_Y, ddy);
    startAnchor.setDynamicProperty(DP_LINE_DIR_Z, ddz);
  }
  clearPending(player);
  player.sendMessage(`§aZipline created (${segCount} segments, ${dist.toFixed(1)} blocks).`);
  player.playSound("note.chime", { volume: 1, pitch: 1.4 });
  try { player.onScreenDisplay.setActionBar(""); } catch (_) {}
}

function cancelPending(player) {
  const startId = player.getDynamicProperty(DP_PENDING_ANCHOR);
  if (typeof startId === "string") {
    const startAnchor = findAnchorById(player.dimension, startId, player.location);
    if (startAnchor) {
      try { startAnchor.remove(); } catch (_) {}
    }
  }
  clearPending(player);
  player.sendMessage("§eZipline placement cancelled.");
  player.playSound("note.bass", { volume: 0.5, pitch: 0.9 });
  try { player.onScreenDisplay.setActionBar(""); } catch (_) {}
}

function removeLine(player, anchor) {
  const lineId = anchor.getDynamicProperty(DP_LINE_ID);
  if (typeof lineId !== "string") return;
  const dim = anchor.dimension;
  const all = dim.getEntities({
    type: ANCHOR,
    location: anchor.location,
    maxDistance: MAX_LINE_BLOCKS + 16,
  });
  const cables = dim.getEntities({
    type: CABLE,
    location: anchor.location,
    maxDistance: MAX_LINE_BLOCKS + 16,
  });
  let removed = 0;
  for (const a of [...all, ...cables]) {
    if (a.getDynamicProperty(DP_LINE_ID) === lineId) {
      try {
        a.remove();
        removed++;
      } catch (_) {}
    }
  }
  player.sendMessage(`§cZipline removed (${removed} segments).`);
  player.playSound("note.bass", { volume: 0.7, pitch: 1.5 });
}

// Point on the wire where the rider's feet go, so they hang suspended below it.
function hangBelow(loc) {
  return { x: loc.x, y: loc.y - RIDE_HANG_OFFSET, z: loc.z };
}

// Look down the line for solid blocks or mobs in the rider's path.
// Two rays / two scans cover both trolley level (feet) and wire level (head),
// so a fence at head height knocks the rider off even when the trolley itself
// would pass under cleanly. Zipline-owned entities (other trolleys, cables,
// anchors) and item drops are excluded so two ziplines don't collide with
// each other and ground litter doesn't trigger a knock-off.
function checkRideCollision(dim, trolley, player, dx, dy, dz) {
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len === 0) return null;
  const unit = { x: dx / len, y: dy / len, z: dz / len };
  const feet = trolley.location;
  const head = { x: feet.x, y: feet.y + RIDE_HEAD_OFFSET, z: feet.z };
  const rayOpts = {
    maxDistance: RIDE_BLOCK_LOOKAHEAD,
    includeLiquidBlocks: false,
    includePassableBlocks: false,
  };
  for (const origin of [feet, head]) {
    try {
      if (dim.getBlockFromRay(origin, unit, rayOpts)) return "block";
    } catch (_) {}
  }
  const queryBase = {
    maxDistance: RIDE_MOB_RADIUS,
    excludeTypes: [TROLLEY, CABLE, ANCHOR, "minecraft:item", "minecraft:xp_orb"],
  };
  for (const origin of [feet, head]) {
    try {
      const nearby = dim.getEntities({ ...queryBase, location: origin });
      for (const e of nearby) if (e.id !== player.id) return "mob";
    } catch (_) {}
  }
  return null;
}

function mountHandle(player, anchor) {
  const lineId = anchor.getDynamicProperty(DP_LINE_ID);
  if (typeof lineId !== "string") return;
  if (typeof player.getDynamicProperty(DP_RIDING_TROLLEY) === "string") return;
  const segIndex = anchor.getDynamicProperty(DP_SEG_INDEX);
  const dim = player.dimension;
  const all = dim.getEntities({
    type: ANCHOR,
    location: player.location,
    maxDistance: MAX_LINE_BLOCKS + 16,
  });
  const start = all.find(
    (a) => a.getDynamicProperty(DP_LINE_ID) === lineId && a.getDynamicProperty(DP_SEG_INDEX) === 0,
  );
  const segCount = start?.getDynamicProperty(DP_SEG_COUNT);

  // Seat the player on an invisible trolley we move along the line. Riding a
  // mount (like a minecart) keeps the camera smooth and lets the player look
  // around freely — directly teleporting the player every tick did not.
  let trolley;
  try {
    trolley = dim.spawnEntity(TROLLEY, hangBelow(anchor.location));
    trolley.getComponent("minecraft:rideable")?.addRider(player);
  } catch (_) {
    if (trolley) { try { trolley.remove(); } catch (_) {} }
    player.sendMessage("§cCouldn't hook onto the zipline.");
    return;
  }

  // Pick a ride direction from the player's view: if they're looking back
  // toward the line's start, ride the reverse direction. Dot product sign is
  // all we need; no normalization required.
  let rideDir = 1;
  let baseSlope = 0;
  if (start) {
    const ldx = start.getDynamicProperty(DP_LINE_DIR_X);
    const ldy = start.getDynamicProperty(DP_LINE_DIR_Y);
    const ldz = start.getDynamicProperty(DP_LINE_DIR_Z);
    if (typeof ldx === "number" && typeof ldy === "number" && typeof ldz === "number") {
      const view = player.getViewDirection();
      const dot = view.x * ldx + view.y * ldy + view.z * ldz;
      rideDir = dot >= 0 ? 1 : -1;
    }
    const cachedSlope = start.getDynamicProperty(DP_LINE_SLOPE);
    if (typeof cachedSlope === "number") baseSlope = cachedSlope * rideDir;
  }

  player.setDynamicProperty(DP_RIDING_LINE, lineId);
  player.setDynamicProperty(DP_RIDING_SEG, typeof segIndex === "number" ? segIndex : 0);
  player.setDynamicProperty(DP_RIDING_COUNT, typeof segCount === "number" ? segCount : MAX_SEGMENTS);
  player.setDynamicProperty(DP_RIDING_TROLLEY, trolley.id);
  player.setDynamicProperty(DP_RIDING_DIR, rideDir);
  player.setDynamicProperty(DP_RIDING_SPEED, 0); // ramps up via RIDE_ACCEL
  player.setDynamicProperty(DP_MOUNT_TICK, system.currentTick);
  // Stash slope on the player so the per-tick loop doesn't have to re-find
  // the start anchor on every tick.
  player.setDynamicProperty(DP_LINE_SLOPE, baseSlope);
  player.sendMessage(
    rideDir > 0
      ? "§aHooked on — riding! §8sneak to dismount"
      : "§aHooked on — riding backward! §8sneak to dismount",
  );
  player.playSound("note.chime", { volume: 1, pitch: 1.4 });
}

function dismountPlayer(player, opts = {}) {
  const wasRiding = typeof player.getDynamicProperty(DP_RIDING_LINE) === "string";
  const trolleyId = player.getDynamicProperty(DP_RIDING_TROLLEY);
  // Read last travel direction + speed BEFORE clearing them so we can carry
  // momentum out of the ride. The collision path passes applyMomentum:false
  // so its backwards knockback isn't cancelled.
  const lastDx = player.getDynamicProperty(DP_RIDING_LAST_DX);
  const lastDz = player.getDynamicProperty(DP_RIDING_LAST_DZ);
  const lastSpeed = player.getDynamicProperty(DP_RIDING_SPEED);
  player.setDynamicProperty(DP_RIDING_LINE, undefined);
  player.setDynamicProperty(DP_RIDING_SEG, undefined);
  player.setDynamicProperty(DP_RIDING_COUNT, undefined);
  player.setDynamicProperty(DP_RIDING_TROLLEY, undefined);
  player.setDynamicProperty(DP_RIDING_DIR, undefined);
  player.setDynamicProperty(DP_RIDING_SPEED, undefined);
  player.setDynamicProperty(DP_RIDING_LAST_DX, undefined);
  player.setDynamicProperty(DP_RIDING_LAST_DZ, undefined);
  player.setDynamicProperty(DP_LINE_SLOPE, undefined);
  player.setDynamicProperty(DP_MOUNT_TICK, undefined);
  // Removing the trolley ejects the rider.
  if (typeof trolleyId === "string") {
    const t = findTrolleyById(player.dimension, trolleyId, player.location);
    if (t) { try { t.remove(); } catch (_) {} }
  }
  if (wasRiding) {
    // Carry forward momentum on a voluntary dismount — fly off the line in
    // the travel direction instead of dropping straight. applyKnockback only
    // works once the rider is no longer a passenger, which is true here
    // because the trolley.remove() above ejected them.
    if (opts.applyMomentum !== false &&
        typeof lastDx === "number" && typeof lastDz === "number" &&
        typeof lastSpeed === "number" && lastSpeed > 0) {
      const flat = Math.sqrt(lastDx * lastDx + lastDz * lastDz);
      if (flat > 0) {
        const factor = (lastSpeed * DISMOUNT_MOMENTUM_GAIN) / flat;
        try {
          player.applyKnockback({ x: lastDx * factor, z: lastDz * factor }, DISMOUNT_VERTICAL_LIFT);
        } catch (_) {}
      }
    }
    // Brief slow-falling so dropping off the line doesn't deal fall damage.
    try {
      player.addEffect("slow_falling", DISMOUNT_SLOWFALL_TICKS, {
        amplifier: DISMOUNT_SLOWFALL_AMPLIFIER,
        showParticles: false,
      });
    } catch (_) {}
    try { player.onScreenDisplay.setActionBar(""); } catch (_) {}
  }
}

// End the ride because something was in the path. Order matters: eject the
// rider first (dismountPlayer removes the trolley, which ejects), then apply
// knockback — applyKnockback on a passenger is silently absorbed by the mount.
function knockOffRide(player, dim, dx, dz) {
  const flat = Math.sqrt(dx * dx + dz * dz) || 1;
  const backX = (-dx / flat) * KNOCKBACK_HORIZ;
  const backZ = (-dz / flat) * KNOCKBACK_HORIZ;
  // applyMomentum:false so dismount doesn't push the rider forward — we want
  // them pitched backwards into whatever they hit.
  dismountPlayer(player, { applyMomentum: false });
  try { player.applyKnockback({ x: backX, z: backZ }, KNOCKBACK_VERT); } catch (_) {}
  try { player.applyDamage(KNOCKBACK_DAMAGE, { cause: EntityDamageCause.entityAttack }); } catch (_) {}
  try { player.playSound("mob.player.hurt", { volume: 1, pitch: 1 }); } catch (_) {}
  try { dim.spawnParticle(COLLISION_PARTICLE, player.location); } catch (_) {}
}

function tickRiders() {
  for (const player of world.getAllPlayers()) {
    const lineId = player.getDynamicProperty(DP_RIDING_LINE);
    if (typeof lineId !== "string") continue;

    const dim = player.dimension;
    const trolley = findTrolleyById(dim, player.getDynamicProperty(DP_RIDING_TROLLEY), player.location);
    if (!trolley) {
      dismountPlayer(player);
      continue;
    }

    const mountTick = player.getDynamicProperty(DP_MOUNT_TICK);
    const ticksSinceMount =
      typeof mountTick === "number" ? system.currentTick - mountTick : MOUNT_GRACE_TICKS;

    // After the grace window, end the ride if the player left the trolley
    // (sneaked off / vanilla dismount) or stopped holding the handle.
    if (ticksSinceMount >= MOUNT_GRACE_TICKS) {
      const ridingOn = player.getComponent("minecraft:riding")?.entityRidingOn;
      if (!ridingOn || ridingOn.id !== trolley.id || player.isSneaking) {
        dismountPlayer(player);
        continue;
      }
    }
    if (getMainhand(player)?.typeId !== HANDLE) {
      dismountPlayer(player);
      continue;
    }

    const segIndex = player.getDynamicProperty(DP_RIDING_SEG);
    const currentSeg = typeof segIndex === "number" ? segIndex : 0;
    const segCount = player.getDynamicProperty(DP_RIDING_COUNT);
    const rideDir = player.getDynamicProperty(DP_RIDING_DIR) === -1 ? -1 : 1;
    const targetSeg = currentSeg + rideDir;
    // Kick off one anchor before whichever endpoint we're heading for, so the
    // rider doesn't glide into the destination/origin block.
    if (typeof segCount === "number" && (targetSeg >= segCount || targetSeg <= 0)) {
      dismountPlayer(player);
      continue;
    }
    const nearby = dim.getEntities({
      type: ANCHOR,
      location: trolley.location,
      maxDistance: RIDE_LOOKAHEAD,
    });
    const next = nearby.find(
      (a) =>
        a.getDynamicProperty(DP_LINE_ID) === lineId &&
        a.getDynamicProperty(DP_SEG_INDEX) === targetSeg,
    );
    if (!next) {
      dismountPlayer(player);
      continue;
    }
    // Slope-driven speed: gravity pulls the rider faster on downhills, slows
    // them on uphills. Actual speed lerps toward the target so motion ramps
    // in instead of snapping at mount / direction change.
    const slope = player.getDynamicProperty(DP_LINE_SLOPE);
    const baseSlope = typeof slope === "number" ? slope : 0;
    const targetSpeed = Math.max(
      RIDE_SPEED_MIN,
      Math.min(RIDE_SPEED_MAX, RIDE_SPEED_BASE * (1 + RIDE_SLOPE_GAIN * baseSlope)),
    );
    const prevSpeed = player.getDynamicProperty(DP_RIDING_SPEED);
    const speed = (typeof prevSpeed === "number" ? prevSpeed : 0)
      + (targetSpeed - (typeof prevSpeed === "number" ? prevSpeed : 0)) * RIDE_ACCEL;
    player.setDynamicProperty(DP_RIDING_SPEED, speed);

    // Glide the trolley toward the next anchor `speed` blocks per tick; the
    // seated player rides along smoothly. Advance the segment once reached.
    const target = hangBelow(next.location);
    const here = trolley.location;
    const dx = target.x - here.x;
    const dy = target.y - here.y;
    const dz = target.z - here.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    let pos = target;
    let reached = true;
    if (d > speed) {
      const f = speed / d;
      pos = { x: here.x + dx * f, y: here.y + dy * f, z: here.z + dz * f };
      reached = false;
    }
    // Look ahead for solid blocks or mobs; on a hit, pitch the rider backwards
    // off the line instead of clipping through the obstacle.
    if (ticksSinceMount >= RIDE_COLLISION_GRACE_TICKS) {
      const hit = checkRideCollision(dim, trolley, player, dx, dy, dz);
      if (hit) {
        knockOffRide(player, dim, dx, dz);
        continue;
      }
    }
    try {
      trolley.teleport(pos);
    } catch (_) {
      dismountPlayer(player);
      continue;
    }
    // Cache the per-tick travel vector so dismount can carry forward momentum.
    player.setDynamicProperty(DP_RIDING_LAST_DX, dx);
    player.setDynamicProperty(DP_RIDING_LAST_DZ, dz);
    if (reached) {
      player.setDynamicProperty(DP_RIDING_SEG, currentSeg + rideDir);
    }
    // Continuous "zip" sound while moving; pitch rises with speed.
    if (ticksSinceMount % RIDE_SOUND_INTERVAL === 0) {
      const pitch = 1.0 + 0.6 * (speed / RIDE_SPEED_MAX);
      try { player.playSound("minecart.base", { volume: 0.4, pitch }); } catch (_) {}
    }
    if (typeof segCount === "number") {
      try {
        const arrow = rideDir > 0 ? "▶" : "◀";
        player.onScreenDisplay.setActionBar(
          `§a${arrow} Ziplining §7(${currentSeg} / ${segCount})  §8sneak to dismount`,
        );
      } catch (_) {}
    }
  }
}

function tickPreviewAndHud() {
  for (const player of world.getAllPlayers()) {
    const pendingLine = player.getDynamicProperty(DP_PENDING_LINE);
    const item = getMainhand(player);
    // Only show the preview while a start is pending and the spool is held.
    if (typeof pendingLine !== "string" || item?.typeId !== PLACER) {
      removePreviewCable(player);
      continue;
    }
    const dim = player.dimension;
    const startAnchorId = player.getDynamicProperty(DP_PENDING_ANCHOR);
    const startAnchor =
      typeof startAnchorId === "string"
        ? findAnchorById(dim, startAnchorId, player.location)
        : null;
    if (!startAnchor) {
      removePreviewCable(player);
      continue;
    }
    const hit = raycastEnd(player);
    // Live ghost cable from the start anchor to where the player is aiming.
    updatePreviewCable(player, dim, startAnchor.location, hit);
    const dist = distance(startAnchor.location, hit);
    try {
      player.onScreenDisplay.setActionBar(
        `§eZipline pending §7— use spool to finish §f(${dist.toFixed(1)} blocks) §8· wrench to cancel`,
      );
    } catch (_) {}
  }
}

function handleUse(player, item) {
  if (!player || !item) return;
  const id = item.typeId;
  if (id === PLACER) {
    if (typeof player.getDynamicProperty(DP_PENDING_LINE) === "string") {
      placeEndAndConnect(player);
    } else {
      placeStartAnchor(player);
    }
  } else if (id === WRENCH) {
    if (typeof player.getDynamicProperty(DP_PENDING_LINE) === "string") {
      cancelPending(player);
      return;
    }
    const a = findAimedAnchor(player);
    if (a) removeLine(player, a);
    else player.sendMessage("§eAim at a zipline anchor and use the wrench.");
  } else if (id === HANDLE) {
    if (typeof player.getDynamicProperty(DP_RIDING_LINE) === "string") {
      return; // no-op while riding; sneak or swap item to dismount
    }
    // Prefer the line the player is actually looking at; only fall back to the
    // nearest wire when they aren't sighting one. This way, when several lines
    // share an anchor, you hook onto the one in your crosshair rather than
    // whichever happens to be closest (e.g. the one directly overhead).
    const aimed = findAimedAnchor(player);
    let a = null;
    if (aimed) {
      const lineId = aimed.getDynamicProperty(DP_LINE_ID);
      a = findNearestAnchorOnLine(player, lineId, MOUNT_AIM_RADIUS);
    }
    // Not looking at a reachable line? Fall back to the closest wire you're
    // standing next to.
    if (!a) a = findNearestAnchor(player, MOUNT_NEAREST_RADIUS);
    if (a) mountHandle(player, a);
    else player.sendMessage("§eLook at or get within ~2 blocks of a zipline to hook on.");
  }
}

function cleanupOrphans() {
  let removed = 0;
  // Trolleys still in use by an online rider; any others are strays (e.g. from
  // a logout mid-ride) and get swept.
  const activeTrolleys = new Set();
  for (const p of world.getAllPlayers()) {
    const t = p.getDynamicProperty(DP_RIDING_TROLLEY);
    if (typeof t === "string") activeTrolleys.add(t);
  }
  for (const dimId of DIMENSION_IDS) {
    const dim = world.getDimension(dimId);
    for (const t of dim.getEntities({ type: TROLLEY })) {
      if (!activeTrolleys.has(t.id)) {
        try {
          t.remove();
          removed++;
        } catch (_) {}
      }
    }
    const all = dim.getEntities({ type: ANCHOR });
    const livingLines = new Set();
    for (const a of all) {
      if (a.getDynamicProperty(DP_SEG_INDEX) === 0) {
        const id = a.getDynamicProperty(DP_LINE_ID);
        if (typeof id === "string") livingLines.add(id);
      }
    }
    const cables = dim.getEntities({ type: CABLE });
    for (const a of [...all, ...cables]) {
      const id = a.getDynamicProperty(DP_LINE_ID);
      const isPreview = a.getDynamicProperty(DP_PREVIEW) === 1;
      if (isPreview || (typeof id === "string" && !livingLines.has(id))) {
        try {
          a.remove();
          removed++;
        } catch (_) {}
      }
    }
  }
  return removed;
}

// Subscribe defensively: an after-event that doesn't exist on this game
// version (e.g. itemUseOn was removed in @minecraft/server 2.x) must not
// throw and halt the rest of the script — that previously stopped the ride
// loop and scriptEventReceive from ever registering.
function subscribeAfter(emitter, name, handler) {
  const sig = emitter?.[name];
  if (sig && typeof sig.subscribe === "function") {
    sig.subscribe(safe(handler));
  } else {
    console.warn(`[zipline] after-event '${name}' unavailable on this version; skipping`);
  }
}

subscribeAfter(world.afterEvents, "itemUse", (event) => {
  handleUse(event.source, event.itemStack);
});

subscribeAfter(world.afterEvents, "entityDie", (event) => {
  const dead = event.deadEntity;
  if (dead?.typeId === "minecraft:player") {
    dismountPlayer(dead);
    clearPending(dead);
  }
});

subscribeAfter(world.afterEvents, "playerDimensionChange", (event) => {
  dismountPlayer(event.player);
});

subscribeAfter(system.afterEvents, "scriptEventReceive", (event) => {
  // Diagnostic that always lands in the Content Log when a script event
  // fires. If /scriptevent zipline:give silently does nothing, the absence
  // of this line tells us the handler isn't being reached at all.
  console.warn(`[zipline] scriptEvent id=${event.id} sourceType=${event.sourceType} hasSourceEntity=${event.sourceEntity != null}`);

  if (event.id === "zipline:cleanup") {
    const removed = cleanupOrphans();
    const msg = `§a[zipline] Cleaned up ${removed} orphan anchor(s).`;
    if (event.sourceEntity?.sendMessage) event.sourceEntity.sendMessage(msg);
    else world.sendMessage(msg);
    return;
  }
  if (event.id === "zipline:give") {
    // Resolve the player: prefer the source, fall back to the only online
    // player if there's exactly one (covers chat sources that don't pass
    // sourceEntity, or command-block runs in single-player worlds).
    let player = event.sourceEntity;
    if (!player || player.typeId !== "minecraft:player") {
      const players = world.getAllPlayers();
      if (players.length === 1) {
        player = players[0];
        world.sendMessage(`§7[zipline] (No source player on the event; giving to ${player.name}.)`);
      } else {
        world.sendMessage("§c[zipline] /scriptevent zipline:give needs a player source. Run it from chat with cheats on.");
        return;
      }
    }
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) {
      player.sendMessage("§c[zipline] Couldn't access your inventory component.");
      return;
    }
    let given = 0;
    for (const id of [PLACER, WRENCH, HANDLE]) {
      try {
        inv.addItem(new ItemStack(id, 1));
        given++;
      } catch (e) {
        player.sendMessage(`§c[zipline] Could not give ${id}: ${e}`);
      }
    }
    player.sendMessage(`§a[zipline] Gave ${given} item(s): Spool, Wrench, Handle.`);
    return;
  }
});

system.runInterval(safe(tickRiders), RIDE_TICK_INTERVAL);
system.runInterval(safe(tickPreviewAndHud), PREVIEW_INTERVAL_TICKS);
