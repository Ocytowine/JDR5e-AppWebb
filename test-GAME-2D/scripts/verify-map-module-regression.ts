require.extensions[".png"] = (module: { exports: string }) => {
  module.exports = "";
};

const {
  WORLD_MAP_LAYOUT
} = require("../map-module/data/worldMapLayout.ts");
const {
  createWorldStateFromMapLayout,
  runSimulationPreflight,
  runWorldHours
} = require("../map-module/world-simulation/index.ts");

type MobilityTrace = {
  actorId: string;
  beforeProgress?: number;
  afterProgress?: number;
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: attendu ${String(expected)}, obtenu ${String(actual)}`);
  }
}

const preflight = runSimulationPreflight(WORLD_MAP_LAYOUT);
assertEqual(preflight.errorCount, 0, "preflight map-module: erreurs");
assertEqual(preflight.warningCount, 0, "preflight map-module: warnings");
console.log("[OK] sandbox map-module: preflight sans erreur ni warning");

const oneHourState = createWorldStateFromMapLayout(WORLD_MAP_LAYOUT);
assertEqual(oneHourState.clock.minutesPerMicroTick, 60, "clock: 1 tick doit valoir 60 minutes");
assertEqual(oneHourState.clock.microPerMacro, 6, "clock: 1 macro tick doit cumuler 6 ticks");

runWorldHours(oneHourState, 1);
assertEqual(oneHourState.clock.tick, 1, "clock apres 1h: tick");
assertEqual(oneHourState.clock.microTick, 1, "clock apres 1h: microTick");
assertEqual(oneHourState.clock.macroTick, 0, "clock apres 1h: macroTick");
console.log("[OK] horloge map-module: 1h = 1 tick");

const sixHourState = createWorldStateFromMapLayout(WORLD_MAP_LAYOUT);
const mobileActors = Object.values(sixHourState.mobileActors) as Array<{
  id: string;
  itineraryMode?: string;
  itinerary?: string[];
}>;

assert(mobileActors.length > 0, "sandbox map-module: aucun mobile acteur trouve");
mobileActors.forEach(actor => {
  assertEqual(actor.itineraryMode, "locked", `${actor.id}: itineraryMode`);
  assert(
    Array.isArray(actor.itinerary) && actor.itinerary.length > 0,
    `${actor.id}: itineraire manuel attendu`
  );
});
console.log("[OK] mobiles map-module: itineraires manuels verrouilles");

const output = runWorldHours(sixHourState, 6);
assertEqual(sixHourState.clock.tick, 6, "clock apres 6h: tick");
assertEqual(sixHourState.clock.microTick, 0, "clock apres 6h: microTick");
assertEqual(sixHourState.clock.macroTick, 1, "clock apres 6h: macroTick");
console.log("[OK] horloge map-module: 6h = 1 macro tick");

const mobility = (output.trace?.mobility ?? []) as MobilityTrace[];
assertEqual(
  mobility.length,
  mobileActors.length * 6,
  "mobilite: une trace par mobile et par heure"
);

const progressByActor = new Map<string, number>();
mobility.forEach(trace => {
  const delta = Math.max(0, Number(trace.afterProgress ?? 0) - Number(trace.beforeProgress ?? 0));
  progressByActor.set(trace.actorId, (progressByActor.get(trace.actorId) ?? 0) + delta);
});

mobileActors.forEach(actor => {
  assert(
    (progressByActor.get(actor.id) ?? 0) > 0,
    `${actor.id}: aucune progression detectee pendant les 6h`
  );
});
console.log("[OK] mobilite map-module: les mobiles avancent pendant le macro tick de 6h");

