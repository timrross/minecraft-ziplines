import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";

const PLACER = "zipline:placer";
const WRENCH = "zipline:wrench";
const HANDLE = "zipline:handle";
const ANCHOR = "zipline:anchor";

const MAX_LINE_BLOCKS = 96;
const SEGMENT_BLOCKS = 1.0;
const MAX_SEGMENTS = 96;
const MIN_LINE_LENGTH = 2.0;
const AIM_RADIUS = 5;
const AIM_PERP_TOLERANCE = 0.9;
const RIDE_TICK_INTERVAL = 1;
const RIDE_LOOKAHEAD = 2;
const REFUND_INGOTS = 7;
const LEVITATION_TICKS = 40;
const LEVITATION_AMPLIFIER = 255;
const DISMOUNT_SLOWFALL_TICKS = 60;
const DISMOUNT_SLOWFALL_AMPLIFIER = 4;

const PARTICLE_INTERVAL_TICKS = 2;
const PARTICLE_VIEW_RADIUS = 48;
const ROPE_PARTICLE = "zipline:rope";
const START_PARTICLE = "zipline:anchor_start";
const END_PARTICLE = "zipline:anchor_end";
const ROPE_INTERPOLATIONS = 4;
const ENDPOINT_COLUMN_HEIGHT = 5;
const ENDPOINT_COLUMN_STEP = 0.2;
const PREVIEW_INTERVAL_TICKS = 2;
const PREVIEW_ROPE_PARTICLES = 8;

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
  const eq = player.getComponent("equippable");
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
  let best = null;
  let bestT = Infinity;
  for (const a of candidates) {
    const dx = a.location.x - origin.x;
    const dy = a.location.y - origin.y;
    const dz = a.location.z - origin.z;
    const t = dx * dir.x + dy * dir.y + dz * dir.z;
    if (t < 0 || t > AIM_RADIUS) continue;
    const px = dx - dir.x * t;
    const py = dy - dir.y * t;
    const pz = dz - dir.z * t;
    const perp = Math.sqrt(px * px + py * py + pz * pz);
    if (perp < AIM_PERP_TOLERANCE && t < bestT) {
      best = a;
      bestT = t;
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

function clearPending(player) {
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
  if (typeof player.getDynamicProperty(DP_PENDING_ANCHOR) === "string") {
    cancelPending(player, true);
  }
  const end = raycastEnd(player);
  const lineId = newLineId();
  const anchor = player.dimension.spawnEntity(ANCHOR, end);
  anchor.setDynamicProperty(DP_LINE_ID, lineId);
  anchor.setDynamicProperty(DP_SEG_INDEX, 0);
  anchor.setDynamicProperty(DP_CREATOR_ID, player.id);
  player.setDynamicProperty(DP_PENDING_LINE, lineId);
  player.setDynamicProperty(DP_PENDING_ANCHOR, anchor.id);
  player.sendMessage("§aZipline start set. Aim and use the spool again to finish.");
  player.playSound("note.bell", { volume: 0.6, pitch: 1.4 });
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
  startAnchor.setDynamicProperty(DP_SEG_COUNT, segCount);
  clearPending(player);
  player.sendMessage(`§aZipline created (${segCount} segments, ${dist.toFixed(1)} blocks).`);
  player.playSound("note.chime", { volume: 1, pitch: 1.4 });
  try { player.onScreenDisplay.setActionBar(""); } catch (_) {}
}

function cancelPending(player, silent) {
  const startId = player.getDynamicProperty(DP_PENDING_ANCHOR);
  if (typeof startId === "string") {
    const startAnchor = findAnchorById(player.dimension, startId, player.location);
    if (startAnchor) {
      try { startAnchor.remove(); } catch (_) {}
    }
  }
  clearPending(player);
  if (!silent) {
    player.sendMessage("§eZipline placement cancelled.");
    player.playSound("note.bass", { volume: 0.5, pitch: 0.9 });
    try { player.onScreenDisplay.setActionBar(""); } catch (_) {}
  }
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
  let removed = 0;
  for (const a of all) {
    if (a.getDynamicProperty(DP_LINE_ID) === lineId) {
      try {
        a.remove();
        removed++;
      } catch (_) {}
    }
  }
  dim.spawnItem(new ItemStack("minecraft:iron_ingot", REFUND_INGOTS), player.location);
  player.sendMessage(`§cZipline removed (${removed} segments).`);
  player.playSound("note.bass", { volume: 0.7, pitch: 1.5 });
}

function mountHandle(player, anchor) {
  const lineId = anchor.getDynamicProperty(DP_LINE_ID);
  if (typeof lineId !== "string") return;
  const segIndex = anchor.getDynamicProperty(DP_SEG_INDEX);
  player.setDynamicProperty(DP_RIDING_LINE, lineId);
  player.setDynamicProperty(DP_RIDING_SEG, typeof segIndex === "number" ? segIndex : 0);
  // Look up segCount from start anchor of the same line
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
  player.setDynamicProperty(
    DP_RIDING_COUNT,
    typeof segCount === "number" ? segCount : MAX_SEGMENTS,
  );
  player.addEffect("levitation", LEVITATION_TICKS, {
    amplifier: LEVITATION_AMPLIFIER,
    showParticles: false,
  });
  player.playSound("note.chime", { volume: 1, pitch: 1.4 });
}

function dismountPlayer(player) {
  const wasRiding = typeof player.getDynamicProperty(DP_RIDING_LINE) === "string";
  player.setDynamicProperty(DP_RIDING_LINE, undefined);
  player.setDynamicProperty(DP_RIDING_SEG, undefined);
  player.setDynamicProperty(DP_RIDING_COUNT, undefined);
  try { player.removeEffect("levitation"); } catch (_) {}
  if (wasRiding) {
    try {
      player.addEffect("slow_falling", DISMOUNT_SLOWFALL_TICKS, {
        amplifier: DISMOUNT_SLOWFALL_AMPLIFIER,
        showParticles: false,
      });
    } catch (_) {}
    try { player.onScreenDisplay.setActionBar(""); } catch (_) {}
  }
}

function tickRiders() {
  for (const player of world.getAllPlayers()) {
    const lineId = player.getDynamicProperty(DP_RIDING_LINE);
    if (typeof lineId !== "string") continue;
    const segIndex = player.getDynamicProperty(DP_RIDING_SEG);
    const currentSeg = typeof segIndex === "number" ? segIndex : 0;
    const segCount = player.getDynamicProperty(DP_RIDING_COUNT);
    const dim = player.dimension;
    const nearby = dim.getEntities({
      type: ANCHOR,
      location: player.location,
      maxDistance: RIDE_LOOKAHEAD,
    });
    const next = nearby.find(
      (a) =>
        a.getDynamicProperty(DP_LINE_ID) === lineId &&
        a.getDynamicProperty(DP_SEG_INDEX) === currentSeg + 1,
    );
    if (!next) {
      dismountPlayer(player);
      continue;
    }
    try {
      player.teleport(next.location);
    } catch (_) {
      dismountPlayer(player);
      continue;
    }
    player.addEffect("levitation", LEVITATION_TICKS, {
      amplifier: LEVITATION_AMPLIFIER,
      showParticles: false,
    });
    player.setDynamicProperty(DP_RIDING_SEG, currentSeg + 1);
    if (typeof segCount === "number") {
      try {
        player.onScreenDisplay.setActionBar(
          `§a▶ Ziplining §7(${currentSeg + 1} / ${segCount})`,
        );
      } catch (_) {}
    }
  }
}

function spawnColumn(dim, loc, particle) {
  for (let i = 0; i < ENDPOINT_COLUMN_HEIGHT; i++) {
    try {
      dim.spawnParticle(particle, {
        x: loc.x,
        y: loc.y + i * ENDPOINT_COLUMN_STEP,
        z: loc.z,
      });
    } catch (_) {}
  }
}

function spawnRopeBetween(dim, a, b, n) {
  for (let i = 1; i < n; i++) {
    const t = i / n;
    try {
      dim.spawnParticle(ROPE_PARTICLE, {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
      });
    } catch (_) {}
  }
}

function tickParticles() {
  const drawnLines = new Set();
  for (const player of world.getAllPlayers()) {
    const dim = player.dimension;
    const anchors = dim.getEntities({
      type: ANCHOR,
      location: player.location,
      maxDistance: PARTICLE_VIEW_RADIUS,
    });
    const byLine = new Map();
    for (const a of anchors) {
      const lineId = a.getDynamicProperty(DP_LINE_ID);
      const segIndex = a.getDynamicProperty(DP_SEG_INDEX);
      if (typeof lineId !== "string" || typeof segIndex !== "number") continue;
      if (!byLine.has(lineId)) byLine.set(lineId, []);
      byLine.get(lineId).push({ anchor: a, segIndex });
    }
    for (const [lineId, segs] of byLine) {
      if (drawnLines.has(lineId)) continue;
      drawnLines.add(lineId);
      segs.sort((x, y) => x.segIndex - y.segIndex);
      const start = segs.find((s) => s.segIndex === 0);
      const segCount = start?.anchor.getDynamicProperty(DP_SEG_COUNT);
      for (let i = 0; i < segs.length; i++) {
        const { anchor, segIndex } = segs[i];
        if (segIndex === 0) {
          spawnColumn(dim, anchor.location, START_PARTICLE);
        } else if (typeof segCount === "number" && segIndex === segCount) {
          spawnColumn(dim, anchor.location, END_PARTICLE);
        } else {
          try { dim.spawnParticle(ROPE_PARTICLE, anchor.location); } catch (_) {}
        }
        const next = segs[i + 1];
        if (next && next.segIndex === segIndex + 1) {
          spawnRopeBetween(dim, anchor.location, next.anchor.location, ROPE_INTERPOLATIONS);
        }
      }
    }
  }
}

function tickPreviewAndHud() {
  for (const player of world.getAllPlayers()) {
    const item = getMainhand(player);
    const heldId = item?.typeId;
    const pendingLine = player.getDynamicProperty(DP_PENDING_LINE);
    const isPending = typeof pendingLine === "string";

    if (heldId === PLACER && (isPending || player.isSneaking)) {
      const dim = player.dimension;
      const hit = raycastEnd(player);
      try { dim.spawnParticle(END_PARTICLE, hit); } catch (_) {}
      if (isPending) {
        const startAnchorId = player.getDynamicProperty(DP_PENDING_ANCHOR);
        const startAnchor =
          typeof startAnchorId === "string"
            ? findAnchorById(dim, startAnchorId, player.location)
            : null;
        if (startAnchor) {
          spawnRopeBetween(dim, startAnchor.location, hit, PREVIEW_ROPE_PARTICLES);
          const dist = distance(startAnchor.location, hit);
          try {
            player.onScreenDisplay.setActionBar(
              `§eZipline pending §7— aim and use to finish §f(${dist.toFixed(1)} blocks)`,
            );
          } catch (_) {}
        }
      }
    }
  }
}

function handleUse(player, item) {
  if (!player || !item) return;
  const id = item.typeId;
  if (id === PLACER) {
    if (player.isSneaking) {
      placeStartAnchor(player);
    } else if (typeof player.getDynamicProperty(DP_PENDING_LINE) === "string") {
      placeEndAndConnect(player);
    } else {
      player.sendMessage("§eSneak + use to set the zipline start.");
    }
  } else if (id === WRENCH) {
    if (player.isSneaking && typeof player.getDynamicProperty(DP_PENDING_LINE) === "string") {
      cancelPending(player, false);
      return;
    }
    const a = findAimedAnchor(player);
    if (a) removeLine(player, a);
    else player.sendMessage("§eAim at a zipline anchor and use the wrench.");
  } else if (id === HANDLE) {
    if (typeof player.getDynamicProperty(DP_RIDING_LINE) === "string") {
      dismountPlayer(player);
      player.sendMessage("§eDismounted.");
    } else {
      const a = findAimedAnchor(player);
      if (a) mountHandle(player, a);
      else player.sendMessage("§eAim at a zipline to mount.");
    }
  }
}

function cleanupOrphans() {
  let removed = 0;
  for (const dimId of DIMENSION_IDS) {
    const dim = world.getDimension(dimId);
    const all = dim.getEntities({ type: ANCHOR });
    const livingLines = new Set();
    for (const a of all) {
      if (a.getDynamicProperty(DP_SEG_INDEX) === 0) {
        const id = a.getDynamicProperty(DP_LINE_ID);
        if (typeof id === "string") livingLines.add(id);
      }
    }
    for (const a of all) {
      const id = a.getDynamicProperty(DP_LINE_ID);
      if (typeof id === "string" && !livingLines.has(id)) {
        try {
          a.remove();
          removed++;
        } catch (_) {}
      }
    }
  }
  return removed;
}

world.afterEvents.itemUse.subscribe(safe((event) => {
  handleUse(event.source, event.itemStack);
}));

world.afterEvents.itemUseOn.subscribe(safe((event) => {
  handleUse(event.source, event.itemStack);
}));

world.afterEvents.entityDie.subscribe(safe((event) => {
  const dead = event.deadEntity;
  if (dead?.typeId === "minecraft:player") {
    dismountPlayer(dead);
    clearPending(dead);
  }
}));

world.afterEvents.playerDimensionChange.subscribe(safe((event) => {
  dismountPlayer(event.player);
}));

system.afterEvents.scriptEventReceive.subscribe(safe((event) => {
  if (event.id !== "zipline:cleanup") return;
  const removed = cleanupOrphans();
  const msg = `§a[zipline] Cleaned up ${removed} orphan anchor(s).`;
  if (event.sourceEntity?.sendMessage) event.sourceEntity.sendMessage(msg);
  else world.sendMessage(msg);
}));

system.runInterval(safe(tickRiders), RIDE_TICK_INTERVAL);
system.runInterval(safe(tickParticles), PARTICLE_INTERVAL_TICKS);
system.runInterval(safe(tickPreviewAndHud), PREVIEW_INTERVAL_TICKS);
