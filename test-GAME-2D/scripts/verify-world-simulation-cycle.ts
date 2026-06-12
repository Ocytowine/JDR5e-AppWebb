import { createExampleWorldState } from "../map-module/world-simulation/exampleScenario.ts";
import { injectCandidateProposal, recomputePressures, runWorldHours } from "../map-module/world-simulation/engine.ts";
import type { WorldFaction } from "../map-module/world-simulation/types.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const state = createExampleWorldState();
const logisticsOffice: WorldFaction = {
  id: "office_logistique:valecroft",
  name: "Office logistique de Valecroft",
  type: "logistics_office",
  tags: ["system", "public", "logistics"],
  influenceZoneIds: ["valecroft", "valecroft-docks", "amber-road"],
  state: {
    resources: 60,
    power: 35,
    influence: 38,
    cohesion: 55,
    aggressiveness: 18,
    discretion: 35,
    security: 42
  },
  objectives: [],
  relations: [],
  recentHistory: [],
  cooldowns: {}
};
const civicOffice: WorldFaction = {
  id: "autorite_civique:valecroft",
  name: "Autorite civique de Valecroft",
  type: "civic_authority",
  tags: ["system", "public", "civic"],
  influenceZoneIds: ["valecroft", "valecroft-docks"],
  state: {
    resources: 55,
    power: 28,
    influence: 42,
    cohesion: 58,
    aggressiveness: 12,
    discretion: 32,
    security: 35
  },
  objectives: [],
  relations: [],
  recentHistory: [],
  cooldowns: {}
};

state.factions[logisticsOffice.id] = logisticsOffice;
state.factions[civicOffice.id] = civicOffice;
state.pressures = recomputePressures(state);

injectCandidateProposal(state, {
  kind: "tension",
  payload: {
    id: "verify:scarcity:valecroft",
    type: "scarcity",
    severity: 85,
    sourceRefs: [{ kind: "city", id: "valecroft" }],
    targetRefs: [{ kind: "city", id: "valecroft" }],
    sinceTick: state.clock.tick,
    tags: ["verify", "market"]
  }
});
injectCandidateProposal(state, {
  kind: "tension",
  payload: {
    id: "verify:scarcity:valecroft:duplicate",
    type: "scarcity",
    severity: 30,
    sourceRefs: [{ kind: "city", id: "valecroft" }],
    targetRefs: [{ kind: "city", id: "valecroft" }],
    sinceTick: state.clock.tick,
    tags: ["verify", "market"]
  }
});
injectCandidateProposal(state, {
  kind: "tension",
  payload: {
    id: "verify:political:greenmarch",
    type: "political",
    severity: 8,
    sourceRefs: [{ kind: "region", id: "greenmarch" }],
    targetRefs: [{ kind: "region", id: "greenmarch" }],
    sinceTick: state.clock.tick,
    tags: ["verify", "cleanup"]
  }
});
injectCandidateProposal(state, {
  kind: "tension",
  payload: {
    id: "verify:political:valecroft-docks",
    type: "political",
    severity: 72,
    sourceRefs: [{ kind: "faction", id: civicOffice.id }],
    targetRefs: [{ kind: "district", id: "valecroft-docks" }],
    sinceTick: state.clock.tick,
    tags: ["verify", "customs_pushback"]
  }
});

const valecroftScarcityTensions = Object.values(state.tensions).filter(
  tension => tension.type === "scarcity" && tension.targetRefs.some(ref => ref.kind === "city" && ref.id === "valecroft")
);
const scarcitySeverityBeforeMacro = state.tensions["verify:scarcity:valecroft"]?.severity ?? 0;
const districtPoliticalSeverityBeforeMacro = state.tensions["verify:political:valecroft-docks"]?.severity ?? 0;

assert(
  state.cities.valecroft.activeTensionIds.includes("verify:scarcity:valecroft"),
  "La tension injectee devrait etre indexee sur la ville cible"
);
assert(
  !state.tensions["verify:scarcity:valecroft:duplicate"],
  "Une tension equivalente devrait renforcer l'existante au lieu de creer un doublon"
);
assert(
  valecroftScarcityTensions.length === 1,
  `Une seule tension de penurie devrait exister pour Valecroft, actuel=${valecroftScarcityTensions.length}`
);
assert(
  scarcitySeverityBeforeMacro > 65,
  `La tension equivalente devrait renforcer la penurie initiale, actuel=${scarcitySeverityBeforeMacro}`
);
assert(
  state.regions.greenmarch.activeTensionIds.includes("verify:political:greenmarch"),
  "La tension faible injectee devrait etre indexee sur la region cible"
);
assert(
  state.districts["valecroft-docks"].activeTensionIds.includes("verify:political:valecroft-docks"),
  "La tension politique injectee devrait etre indexee sur le quartier cible"
);
assert(
  state.cities.valecroft.recentHistory.some(entry => entry.type === "tension_created"),
  "La creation de tension devrait etre inscrite dans l'historique local"
);
assert(
  state.cities.valecroft.recentHistory.some(entry => entry.type === "tension_reinforced"),
  "Le renforcement de tension devrait etre inscrit dans l'historique local"
);

const output = runWorldHours(state, state.clock.microPerMacro);
const scarcityTension = state.tensions["verify:scarcity:valecroft"];
const resolvedTension = state.tensions["verify:political:greenmarch"];
const districtPoliticalTension = state.tensions["verify:political:valecroft-docks"];
const generatedSystemObjectives = Object.values(state.specialObjectives).filter(objective => objective.tags.includes("system_generated"));
const logisticsGoals = state.factions[logisticsOffice.id]?.objectives ?? [];
const civicGoals = state.factions[civicOffice.id]?.objectives ?? [];

assert(Boolean(scarcityTension), "La tension de penurie devrait rester active apres un macro tick");
assert(!resolvedTension, "La tension politique faible devrait etre resolue apres un macro tick");
assert(Boolean(districtPoliticalTension), "La tension politique de quartier devrait rester observable apres un macro tick");
assert(
  scarcityTension.severity < scarcitySeverityBeforeMacro,
  `L'action systeme devrait soulager la penurie active, avant=${scarcitySeverityBeforeMacro}, actuel=${scarcityTension.severity}`
);
assert(
  districtPoliticalTension.severity < districtPoliticalSeverityBeforeMacro,
  `L'action civique devrait soulager la tension politique locale, avant=${districtPoliticalSeverityBeforeMacro}, actuel=${districtPoliticalTension.severity}`
);
assert(
  !state.regions.greenmarch.activeTensionIds.includes("verify:political:greenmarch"),
  "Une tension resolue devrait etre retiree des activeTensionIds de la region"
);
assert(
  state.regions.greenmarch.recentHistory.some(entry => entry.type === "tension_resolved"),
  "La resolution de tension devrait etre historisee sur la region"
);
assert(
  state.cities.valecroft.recentHistory.some(entry => entry.type === "tension_escalated"),
  "L'intensification de tension devrait etre historisee"
);
assert(
  state.cities.valecroft.recentHistory.some(entry => entry.type === "tension_relieved"),
  "Le soulagement d'une tension par une action systeme devrait etre historise"
);
assert(
  state.districts["valecroft-docks"].recentHistory.some(
    entry => entry.type === "tension_relieved" && entry.summary.includes("political")
  ),
  "Le soulagement d'une tension politique locale devrait etre historise sur le quartier"
);
assert(
  output.deltas.some(delta => delta.meta?.source === "tension:verify:scarcity:valecroft"),
  "Une tension forte devrait produire des deltas systemiques"
);
assert(
  generatedSystemObjectives.some(objective => objective.id.startsWith(`objective:system:reopen_market:${logisticsOffice.id}:`)),
  "Une tension de marche devrait declencher un objectif systeme reopen_market"
);
assert(
  logisticsGoals.some(goal => goal.objectiveId.startsWith(`objective:system:reopen_market:${logisticsOffice.id}:`)),
  "La faction systeme devrait recevoir l'objectif de marche dans sa file d'objectifs"
);
assert(
  generatedSystemObjectives.some(objective => objective.id.startsWith(`objective:system:reduce_fear:${civicOffice.id}:`)),
  "Une tension politique locale devrait declencher un objectif systeme reduce_fear"
);
assert(
  civicGoals.some(goal => goal.objectiveId.startsWith(`objective:system:reduce_fear:${civicOffice.id}:`)),
  "La faction civique devrait recevoir l'objectif de stabilisation dans sa file d'objectifs"
);

const historyLengthAfterFirstMacro = state.cities.valecroft.recentHistory.length;
const scarcitySeverityAfterFirstMacro = scarcityTension.severity;
const longRunOutputs = [
  runWorldHours(state, state.clock.microPerMacro),
  runWorldHours(state, state.clock.microPerMacro),
  runWorldHours(state, state.clock.microPerMacro)
];
const longRunDeltas = longRunOutputs.flatMap(entry => entry.deltas);
const longRunEvents = longRunOutputs.flatMap(entry => entry.events);
const longRunTension = state.tensions["verify:scarcity:valecroft"];
const longRunObjectiveIds = new Set(
  Object.values(state.specialObjectives)
    .filter(objective => objective.tags.includes("system_generated"))
    .map(objective => objective.id)
);

assert(state.clock.macroTick >= 4, `Le scenario long devrait avoir avance au moins 4 macro ticks, actuel=${state.clock.macroTick}`);
assert(longRunEvents.length > 0, "Le monde devrait continuer a produire des evenements sur plusieurs macro ticks");
assert(longRunDeltas.length > 0, "Le monde devrait continuer a produire des deltas sur plusieurs macro ticks");
assert(
  state.cities.valecroft.recentHistory.length >= historyLengthAfterFirstMacro,
  "La memoire de la ville ne devrait pas regresser pendant le scenario long"
);
assert(
  state.cities.valecroft.recentHistory.some(entry => entry.tick > output.tick),
  "La memoire de la ville devrait recevoir des entrees apres le premier macro tick"
);
assert(Boolean(longRunTension), "La tension de penurie devrait rester observable pendant le scenario long");
assert(
  longRunTension.severity !== scarcitySeverityAfterFirstMacro,
  "La tension de penurie devrait continuer a evoluer sur plusieurs macro ticks"
);
assert(
  longRunObjectiveIds.size > 0,
  "Des objectifs systeme devraient rester generes ou reconciles pendant le scenario long"
);

console.log("[OK] tension injectee -> index activeTensionIds + historique");
console.log("[OK] macro tick -> tension soulagee mais encore capable de produire des deltas systemiques");
console.log("[OK] tension faible -> resolution + nettoyage activeTensionIds");
console.log("[OK] tension de marche -> objectif systeme reopen_market assigne");
console.log("[OK] tension politique locale -> objectif civique + tension_relieved");
console.log("[OK] scenario long -> evenements, deltas, historique et tensions continuent d'evoluer");
console.log("\nVerification world-simulation-cycle reussie.");
