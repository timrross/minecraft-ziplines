#!/usr/bin/env node
// Pre-build validation for the Zipline Bedrock add-on.
//
// Catches the specific traps this project has paid to learn — manifest
// drift, stale @minecraft/server version, removed-event subscriptions,
// short-name getComponent calls, missing recipe unlock, deprecated entity
// components — *before* an .mcaddon is built and re-imported. Each check
// targets a real failure mode that has bitten us in development.
//
// Usage: node validate.js   (or `./build.sh`, which calls this first)
// Exit 0 on success, 1 on any error. Warnings don't fail the build.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BP_DIR = path.join(__dirname, "zipline_BP");
const RP_DIR = path.join(__dirname, "zipline_RP");
const SCRIPT = path.join(BP_DIR, "scripts/main.js");

const SERVER_VERSION_FLOOR = "2.7.0";   // @minecraft/server we expect on v26
const ENGINE_FLOOR = [1, 26, 0];        // matches v26.x internal version

let errors = 0;
let warnings = 0;
const err  = (m) => { errors++;   console.error(`✗ ${m}`); };
const warn = (m) => { warnings++; console.warn (`! ${m}`); };
const info = (m) => { console.log (`· ${m}`); };

function walk(dir, ext = ".json") {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext));
    else if (e.isFile() && p.endsWith(ext)) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(__dirname, p);
const cmpVer = (a, b) => {
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  return 0;
};
const cmpSemver = (a, b) => cmpVer(a.split(".").map(Number), b.split(".").map(Number));

// ---------------------------------------------------------------------------
// 1. Every .json file parses.
// ---------------------------------------------------------------------------
function checkJsonParse() {
  const files = [...walk(BP_DIR), ...walk(RP_DIR)];
  let bad = 0;
  for (const f of files) {
    try { JSON.parse(fs.readFileSync(f, "utf8")); }
    catch (e) { err(`${rel(f)}: invalid JSON — ${e.message}`); bad++; }
  }
  if (!bad) info(`parsed ${files.length} JSON files`);
}

// ---------------------------------------------------------------------------
// 2. Manifests align with each other and with the runtime floor.
// ---------------------------------------------------------------------------
function checkManifests() {
  const bpPath = path.join(BP_DIR, "manifest.json");
  const rpPath = path.join(RP_DIR, "manifest.json");
  let bp, rp;
  try { bp = JSON.parse(fs.readFileSync(bpPath, "utf8")); }
  catch (e) { err(`BP manifest unreadable: ${e.message}`); return; }
  try { rp = JSON.parse(fs.readFileSync(rpPath, "utf8")); }
  catch (e) { err(`RP manifest unreadable: ${e.message}`); return; }

  const bpVer = bp.header.version.join(".");
  const rpVer = rp.header.version.join(".");

  // BP→RP cross-dependency must match RP header version.
  const bpToRp = (bp.dependencies || []).find((d) => d.uuid === rp.header.uuid);
  if (!bpToRp) {
    err(`BP manifest is missing a dependency on RP (uuid ${rp.header.uuid})`);
  } else if (bpToRp.version.join(".") !== rpVer) {
    err(`BP→RP dep version ${bpToRp.version.join(".")} ≠ RP header ${rpVer} (worlds will cache stale)`);
  }

  // RP→BP cross-dependency must match BP header version.
  const rpToBp = (rp.dependencies || []).find((d) => d.uuid === bp.header.uuid);
  if (!rpToBp) {
    warn(`RP manifest has no dependency on BP (uuid ${bp.header.uuid})`);
  } else if (rpToBp.version.join(".") !== bpVer) {
    err(`RP→BP dep version ${rpToBp.version.join(".")} ≠ BP header ${bpVer} (worlds will cache stale)`);
  }

  // @minecraft/server module version — stale here silently rejects the whole BP.
  const serverDep = (bp.dependencies || []).find((d) => d.module_name === "@minecraft/server");
  if (!serverDep) {
    err(`BP manifest is missing the @minecraft/server module dependency`);
  } else if (cmpSemver(serverDep.version, SERVER_VERSION_FLOOR) < 0) {
    err(`@minecraft/server ${serverDep.version} < floor ${SERVER_VERSION_FLOOR} (pack will be rejected on v26)`);
  }

  // min_engine_version must allow v26.
  if (cmpVer(bp.header.min_engine_version, ENGINE_FLOOR) < 0) {
    err(`BP min_engine_version ${bp.header.min_engine_version.join(".")} < ${ENGINE_FLOOR.join(".")}`);
  }
  if (cmpVer(rp.header.min_engine_version, ENGINE_FLOOR) < 0) {
    err(`RP min_engine_version ${rp.header.min_engine_version.join(".")} < ${ENGINE_FLOOR.join(".")}`);
  }

  info(`manifests aligned at v${bpVer}`);
}

// ---------------------------------------------------------------------------
// 3. Recipes have unlock data (required on 1.20+).
// ---------------------------------------------------------------------------
function checkRecipes() {
  const files = walk(path.join(BP_DIR, "recipes"));
  for (const f of files) {
    let r; try { r = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
    const key = Object.keys(r).find((k) => k.startsWith("minecraft:recipe_"));
    if (!key) continue;
    if (!r[key].unlock) {
      err(`${rel(f)}: missing "unlock" data (required on 1.20+ recipes)`);
    }
  }
  if (files.length) info(`checked ${files.length} recipes for unlock data`);
}

// ---------------------------------------------------------------------------
// 4. Entity definitions don't use components removed from the v26 schema.
// ---------------------------------------------------------------------------
const DEPRECATED_ENTITY_COMPONENTS = ["minecraft:invulnerable"];

function checkEntities() {
  const files = walk(path.join(BP_DIR, "entities"));
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    for (const comp of DEPRECATED_ENTITY_COMPONENTS) {
      if (text.includes(`"${comp}"`)) {
        err(`${rel(f)}: uses ${comp} (removed from v26 schema)`);
      }
    }
  }
  if (files.length) info(`checked ${files.length} entity files for deprecated components`);
}

// ---------------------------------------------------------------------------
// 5. Script: removed APIs, short-form component names, basic syntax.
// ---------------------------------------------------------------------------
const REMOVED_EVENTS = [
  // event name → why it was removed / what to use instead
  ["itemUseOn", "removed in @minecraft/server 2.x; itemUse or playerInteractWithBlock cover this"],
];

const KNOWN_NAMESPACED_COMPONENTS = new Set([
  // Components that *require* the "minecraft:" prefix in 2.x; calling
  // getComponent("inventory") etc. returns undefined and silently breaks
  // anything depending on it.
  "equippable",
  "inventory",
  "rideable",
  "riding",
  "leashable",
  "health",
  "movement",
  "navigation",
  "type_family",
  "variant",
  "physics",
  "damage_sensor",
]);

function stripComments(src) {
  // Remove block + line comments so regex checks don't false-positive on
  // documentation. Cheap and good enough for our checks.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function checkScript() {
  if (!fs.existsSync(SCRIPT)) {
    warn(`script not found at ${rel(SCRIPT)}`);
    return;
  }

  // Syntax check first — no point grepping a file Node can't parse.
  try {
    execFileSync("node", ["--check", SCRIPT], { stdio: "pipe" });
  } catch (e) {
    const msg = (e.stderr?.toString() || e.message).trim();
    err(`${rel(SCRIPT)}: syntax error\n  ${msg.split("\n").slice(0, 3).join("\n  ")}`);
    return;
  }

  const raw = fs.readFileSync(SCRIPT, "utf8");
  const text = stripComments(raw);

  for (const [name, reason] of REMOVED_EVENTS) {
    const pat = new RegExp(`\\bafterEvents\\.${name}\\.subscribe\\b`);
    if (pat.test(text)) {
      err(`${rel(SCRIPT)}: subscribes to afterEvents.${name} — ${reason}`);
    }
  }

  // getComponent("shortname") where shortname needs the minecraft: prefix.
  const re = /getComponent\(\s*["'](?!minecraft:)([a-z_]+)["']\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    if (KNOWN_NAMESPACED_COMPONENTS.has(name)) {
      err(`${rel(SCRIPT)}: getComponent("${name}") needs "minecraft:" prefix on 2.x`);
    }
  }

  info(`checked ${rel(SCRIPT)} for removed events and short component names`);
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------
console.log("=== zipline-bedrock validate ===");
checkJsonParse();
checkManifests();
checkRecipes();
checkEntities();
checkScript();
console.log("");

if (errors > 0) {
  console.error(`✗ FAIL  ${errors} error${errors === 1 ? "" : "s"}` +
    (warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""));
  process.exit(1);
} else {
  console.log(`✓ OK    no errors` + (warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""));
}
