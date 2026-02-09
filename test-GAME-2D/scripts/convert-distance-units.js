/* Convert distance-like fields from cells to meters (1 cell = 1.5m). */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const CELL_TO_M = 1.5;

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function writeJson(filePath, json) {
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n", "utf8");
}

function listJsonFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "models") continue;
      files.push(...listJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(full);
    }
  }
  return files;
}

function mult(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return n;
  const v = n * CELL_TO_M;
  return Math.round(v * 100) / 100;
}

function convertAction(action) {
  if (action?.targeting?.range) {
    const r = action.targeting.range;
    if (typeof r.min === "number") r.min = mult(r.min);
    if (typeof r.max === "number") r.max = mult(r.max);
  }
  if (Array.isArray(action?.conditions)) {
    for (const cond of action.conditions) {
      if (!cond || typeof cond !== "object") continue;
      if (cond.type === "distance_max" && typeof cond.max === "number") {
        cond.max = mult(cond.max);
      }
      if (cond.type === "distance_between") {
        if (typeof cond.min === "number") cond.min = mult(cond.min);
        if (typeof cond.max === "number") cond.max = mult(cond.max);
      }
    }
  }
  if (Array.isArray(action?.effects)) {
    for (const eff of action.effects) {
      if (!eff || typeof eff !== "object") continue;
      if (eff.type === "move" && typeof eff.maxSteps === "number") {
        eff.maxSteps = mult(eff.maxSteps);
      }
      if (eff.type === "move_to" && typeof eff.maxSteps === "number") {
        eff.maxSteps = mult(eff.maxSteps);
      }
    }
  }
}

function convertWeapon(obj) {
  const props = obj?.properties;
  if (props) {
    if (typeof props.reach === "number") props.reach = mult(props.reach);
    if (props.range) {
      if (typeof props.range.normal === "number") props.range.normal = mult(props.range.normal);
      if (typeof props.range.long === "number") props.range.long = mult(props.range.long);
    }
    if (props.thrown) {
      if (typeof props.thrown.normal === "number") props.thrown.normal = mult(props.thrown.normal);
      if (typeof props.thrown.long === "number") props.thrown.long = mult(props.thrown.long);
    }
  }
}

function convertEnemy(obj) {
  if (obj.combatStats) {
    if (typeof obj.combatStats.moveRange === "number") {
      obj.combatStats.moveRange = mult(obj.combatStats.moveRange);
    }
  }
  if (obj.movementModes && typeof obj.movementModes === "object") {
    for (const key of Object.keys(obj.movementModes)) {
      const val = obj.movementModes[key];
      if (typeof val === "number") obj.movementModes[key] = mult(val);
    }
  }
  if (obj.movement && typeof obj.movement.speed === "number") {
    obj.movement.speed = mult(obj.movement.speed);
  }
  if (obj.combatProfile) {
    for (const key of [
      "preferredRangeMin",
      "preferredRangeMax",
      "avoidRangeMin",
      "avoidRangeMax"
    ]) {
      if (typeof obj.combatProfile[key] === "number") {
        obj.combatProfile[key] = mult(obj.combatProfile[key]);
      }
    }
  }
  if (obj.behavior) {
    for (const key of ["preferredRangeMin", "preferredRangeMax", "panicRange"]) {
      if (typeof obj.behavior[key] === "number") {
        obj.behavior[key] = mult(obj.behavior[key]);
      }
    }
  }
  if (obj.vision && typeof obj.vision.range === "number") {
    obj.vision.range = mult(obj.vision.range);
  }
}

const files = listJsonFiles(DATA_DIR);
for (const filePath of files) {
  let json;
  try {
    json = readJson(filePath);
  } catch {
    continue;
  }
  const before = JSON.stringify(json);

  // Actions, reactions with embedded action
  if (json && typeof json === "object") {
    if (json.action && json.trigger) {
      convertAction(json.action);
    } else {
      convertAction(json);
    }
  }

  // Weapons
  if (json && json.properties && json.damage && json.links) {
    convertWeapon(json);
  }

  // Enemies
  if (json && json.combatStats && json.appearance && json.aiRole) {
    convertEnemy(json);
  }

  const after = JSON.stringify(json);
  if (before !== after) {
    writeJson(filePath, json);
  }
}

console.log("Distance conversion to meters complete.");
