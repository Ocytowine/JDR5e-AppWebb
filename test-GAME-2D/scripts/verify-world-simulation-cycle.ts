import { createExampleWorldState } from "../map-module/world-simulation/exampleScenario.ts";
import { injectCandidateProposal, recomputePressures, runWorldHours } from "../map-module/world-simulation/engine.ts";
import { reconcileAutonomousMobiles } from "../map-module/world-simulation/mobileGeneration.ts";
import type { MobileActor, ObjectivePhaseRuntime, SpecialObjective, WorldFaction } from "../map-module/world-simulation/types.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function createRuntimeMobileObjective(id: string, ownerFactionId: string, state: SpecialObjective["state"] = "active"): SpecialObjective {
  return {
    id,
    category: "secure_corridor",
    owner: { kind: "faction", id: ownerFactionId },
    target: { kind: "route", id: "amber-road" },
    priority: 50,
    state,
    progress: 0,
    zoneIds: ["amber-road"],
    phases: [],
    currentPhaseIndex: 0,
    phaseHistory: [],
    obstacles: [],
    compatibleActionIds: ["secure_route"],
    failureScore: 0,
    maxFailureScore: 100,
    fatalFailureConditions: [],
    onSuccess: [],
    onFailure: [],
    successConsequencesApplied: false,
    failureConsequencesApplied: false,
    tags: ["system_generated"]
  };
}

function createVerifyPhase(id: string, label: string, compatibleActionIds: ObjectivePhaseRuntime["compatibleActionIds"], completionThreshold: number): ObjectivePhaseRuntime {
  return {
    id,
    label,
    state: "planned",
    zoneIds: ["amber-road"],
    compatibleActionIds,
    progress: 0,
    progressWeight: 1,
    completionMode: "progress_threshold",
    completionThreshold,
    failureScore: 0,
    maxFailureScore: 100,
    failureMode: "score_threshold",
    fatalFailureConditions: []
  };
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
const merchantLeague: WorldFaction = {
  id: "ligue_marchande:valecroft",
  name: "Ligue marchande de Valecroft",
  type: "merchant_league",
  tags: ["commerce", "trade", "merchant"],
  influenceZoneIds: ["valecroft", "valecroft-docks", "amber-road"],
  state: {
    resources: 70,
    power: 30,
    influence: 45,
    cohesion: 50,
    aggressiveness: 16,
    discretion: 30,
    security: 34
  },
  objectives: [],
  relations: [{ otherFactionId: "faction-militia", status: "ally", trust: 72, hostility: 18 }],
  recentHistory: [],
  cooldowns: {}
};

state.factions[logisticsOffice.id] = logisticsOffice;
state.factions[civicOffice.id] = civicOffice;
state.factions[merchantLeague.id] = merchantLeague;
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
injectCandidateProposal(state, {
  kind: "tension",
  payload: {
    id: "verify:mobility:amber-road",
    type: "mobility_risk",
    severity: 62,
    sourceRefs: [{ kind: "route", id: "amber-road" }],
    targetRefs: [{ kind: "route", id: "amber-road" }],
    sinceTick: state.clock.tick,
    tags: ["verify", "route_risk"]
  }
});

const valecroftScarcityTensions = Object.values(state.tensions).filter(
  tension => tension.type === "scarcity" && tension.targetRefs.some(ref => ref.kind === "city" && ref.id === "valecroft")
);
const scarcitySeverityBeforeMacro = state.tensions["verify:scarcity:valecroft"]?.severity ?? 0;
const districtPoliticalSeverityBeforeMacro = state.tensions["verify:political:valecroft-docks"]?.severity ?? 0;
const guildResourcesBeforeMacro = state.factions["faction-guild"].state.resources ?? 0;
const guildInfluenceBeforeMacro = state.factions["faction-guild"].state.influence ?? 0;
const guildMilitiaHostilityBefore = state.factions["faction-guild"].relations.find(
  relation => relation.otherFactionId === "faction-militia"
)?.hostility ?? 0;
const merchantMilitiaTrustBefore = merchantLeague.relations.find(
  relation => relation.otherFactionId === "faction-militia"
)?.trust ?? 0;

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
  state.routes["amber-road"].activeTensionIds.includes("verify:mobility:amber-road"),
  "La tension de mobilite injectee devrait etre indexee sur la route cible"
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
const generatedFactionObjectives = Object.values(state.specialObjectives).filter(objective => objective.tags.includes("faction_generated"));
const logisticsGoals = state.factions[logisticsOffice.id]?.objectives ?? [];
const civicGoals = state.factions[civicOffice.id]?.objectives ?? [];
const guildGoals = state.factions["faction-guild"]?.objectives ?? [];
const militiaGoals = state.factions["faction-militia"]?.objectives ?? [];
const merchantGoals = state.factions[merchantLeague.id]?.objectives ?? [];
const generatedRuntimeMobiles = Object.values(state.mobileActors).filter(actor => actor.id.startsWith("mobile:runtime:"));

assert(Boolean(scarcityTension), "La tension de penurie devrait rester active apres un macro tick");
assert(!resolvedTension, "La tension politique faible devrait etre resolue apres un macro tick");
assert(Boolean(districtPoliticalTension), "La tension politique de quartier devrait rester observable apres un macro tick");
assert(
  scarcityTension.severity >= 55,
  `La penurie devrait rester assez forte pour alimenter une competition systeme/opportuniste, actuel=${scarcityTension.severity}`
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
  generatedRuntimeMobiles.some(actor => actor.owner?.id === logisticsOffice.id && actor.recentHistory.some(entry => entry.type === "mobile_generated")),
  "Une faction systeme sans mobile devrait generer un mobile autonome pour son objectif"
);

const blockedMobileGenerationState = createExampleWorldState();
blockedMobileGenerationState.mobileActors = {};
const blockedFaction = blockedMobileGenerationState.factions["faction-militia"];
blockedFaction.tags = ["system", "military"];
blockedFaction.influenceZoneIds = ["valecroft", "amber-road"];
blockedFaction.objectives = [{ objectiveId: "verify:blocked-mobile-objective", priority: 80 }];
blockedMobileGenerationState.specialObjectives["verify:blocked-mobile-objective"] = createRuntimeMobileObjective(
  "verify:blocked-mobile-objective",
  blockedFaction.id,
  "blocked"
);
const blockedGeneratedMobiles = reconcileAutonomousMobiles(blockedMobileGenerationState);
assert(
  blockedGeneratedMobiles.length === 0,
  "Un objectif blocked ne devrait pas generer de mobile autonome"
);

const generationLimitState = createExampleWorldState();
generationLimitState.mobileActors = {};
generationLimitState.factions = {};
generationLimitState.specialObjectives = {};
for (let index = 0; index < 16; index += 1) {
  const factionId = `verify:system:faction:${index}`;
  const objectiveId = `verify:system:objective:${index}`;
  generationLimitState.factions[factionId] = {
    id: factionId,
    name: `System Faction ${index}`,
    type: "regional_patrol",
    tags: ["system", "military"],
    influenceZoneIds: ["valecroft", "amber-road"],
    state: {
      resources: 80,
      power: 40,
      influence: 40,
      cohesion: 50,
      aggressiveness: 20,
      discretion: 30,
      security: 50
    },
    objectives: [{ objectiveId, priority: 70 }],
    relations: [],
    recentHistory: [],
    cooldowns: {}
  };
  generationLimitState.specialObjectives[objectiveId] = createRuntimeMobileObjective(objectiveId, factionId);
}
const generatedAtLimit = reconcileAutonomousMobiles(generationLimitState);
assert(
  generatedAtLimit.length === 16,
  `Le generateur devrait pouvoir remplir le plafond runtime a 16 mobiles, actuel=${generatedAtLimit.length}`
);

assert(
  generatedFactionObjectives.some(objective => objective.id.startsWith("objective:faction:opportunity:criminal:faction-guild:")),
  "Une tension de penurie devrait creer un objectif opportuniste pour la guilde criminelle"
);
assert(
  generatedFactionObjectives.some(
    objective =>
      objective.id.startsWith("objective:faction:relation:rival:faction-guild:faction-militia:") &&
      objective.tags.includes("relation_generated")
  ),
  "Une relation hostile devrait creer un objectif faction_generated anti-rival"
);
assert(
  guildGoals.some(goal => goal.objectiveId.startsWith("objective:faction:opportunity:criminal:faction-guild:")),
  "La guilde criminelle devrait recevoir l'objectif opportuniste dans sa file d'objectifs"
);
assert(
  guildGoals.some(goal => goal.objectiveId.startsWith("objective:faction:relation:rival:faction-guild:faction-militia:")),
  "La guilde criminelle devrait recevoir l'objectif relationnel anti-rival"
);
const firstMacroExtortSucceeded = output.trace?.selectedActions.some(
  action => action.actorRef.id === "faction-guild" && action.actionId === "extort" && action.success
) ?? false;
const firstMacroSelectedActions = output.trace?.selectedActions ?? [];
assert(
  firstMacroSelectedActions.length > 0 && firstMacroSelectedActions.every(action => Boolean(action.actionCause?.kind)),
  "Les actions retenues devraient exposer une cause d'action structuree"
);
assert(
  generatedFactionObjectives.some(objective => objective.id.startsWith("objective:faction:opportunity:military_route:faction-militia:")),
  "Une tension de route devrait creer un objectif opportuniste militaire pour la milice"
);
assert(
  militiaGoals.some(goal => goal.objectiveId.startsWith("objective:faction:opportunity:military_route:faction-militia:")),
  "La milice devrait recevoir l'objectif opportuniste de corridor"
);
assert(
  generatedFactionObjectives.some(objective => objective.id.startsWith(`objective:faction:opportunity:merchant:${merchantLeague.id}:`)),
  "Une tension de penurie devrait creer un objectif opportuniste marchand"
);
assert(
  generatedFactionObjectives.some(
    objective =>
      objective.id.startsWith(`objective:faction:relation:ally:${merchantLeague.id}:faction-militia:amber-road`) &&
      objective.tags.includes("cooperation_generated")
  ),
  "Une relation de confiance devrait creer un objectif cooperatif sur un corridor partage"
);
assert(
  merchantGoals.some(goal => goal.objectiveId.startsWith(`objective:faction:opportunity:merchant:${merchantLeague.id}:`)),
  "La faction marchande devrait recevoir l'objectif opportuniste dans sa file d'objectifs"
);
assert(
  merchantGoals.some(goal => goal.objectiveId.startsWith(`objective:faction:relation:ally:${merchantLeague.id}:faction-militia:amber-road`)),
  "La faction marchande devrait recevoir l'objectif cooperatif dans sa file d'objectifs"
);
assert(
  output.trace?.selectedActions.some(
    action =>
      action.actorRef.id === merchantLeague.id &&
      (action.actionId === "reopen_market" || action.actionId === "relief_distribution") &&
      action.success &&
      Boolean(action.actionCause?.kind)
  ),
  "La faction marchande devrait agir sur son opportunite de marche avec une cause lisible"
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
const longRunExtortSucceeded = longRunOutputs.some(entry =>
  entry.trace?.selectedActions.some(action => action.actorRef.id === "faction-guild" && action.actionId === "extort" && action.success)
);
const militiaSecuredRoute = [output, ...longRunOutputs].some(entry =>
  entry.trace?.selectedActions.some(action => action.actorRef.id === "faction-militia" && action.actionId === "secure_route" && action.success)
);
const guildMilitiaHostilityAfter = state.factions["faction-guild"].relations.find(
  relation => relation.otherFactionId === "faction-militia"
)?.hostility ?? 0;
const merchantMilitiaTrustAfter = state.factions[merchantLeague.id].relations.find(
  relation => relation.otherFactionId === "faction-militia"
)?.trust ?? 0;

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
assert(
  firstMacroExtortSucceeded || longRunExtortSucceeded,
  "La guilde criminelle devrait exploiter la crise avec extort sur le scenario court"
);
assert(
  (state.factions["faction-guild"].state.resources ?? 0) > guildResourcesBeforeMacro ||
    (state.factions["faction-guild"].state.influence ?? 0) > guildInfluenceBeforeMacro,
  "L'exploitation opportuniste devrait augmenter les ressources ou l'influence de la guilde"
);
assert(
  state.districts["valecroft-docks"].recentHistory.some(
    entry => (entry.type === "tension_created" || entry.type === "tension_reinforced") && entry.summary.includes("extortion_spree")
  ) ||
    state.routes["amber-road"].recentHistory.some(entry => entry.type === "mobile_ambush_effect") ||
    Object.values(state.tensions).some(
      tension =>
        tension.type === "criminal" &&
        (tension.tags.includes("extortion_spree") || tension.tags.includes("ambush")) &&
        tension.targetRefs.some(ref => ref.id === "valecroft-docks" || ref.id === "amber-road")
    ),
  "L'exploitation criminelle ou l'embuscade mobile devrait produire une crise visible"
);
assert(
  guildMilitiaHostilityAfter > guildMilitiaHostilityBefore,
  `L'extorsion devrait augmenter l'hostilite guilde/milice, avant=${guildMilitiaHostilityBefore}, apres=${guildMilitiaHostilityAfter}`
);
assert(
  militiaSecuredRoute,
  "La milice devrait securiser la route dans le scenario court"
);
assert(
  merchantMilitiaTrustAfter > 35,
  `La securisation de route devrait augmenter la confiance marchands/milice, actuel=${merchantMilitiaTrustAfter}`
);
assert(
  merchantMilitiaTrustAfter >= merchantMilitiaTrustBefore,
  `La cooperation ne devrait pas degrader la confiance marchands/milice, avant=${merchantMilitiaTrustBefore}, apres=${merchantMilitiaTrustAfter}`
);

const phaseTransitionState = createExampleWorldState();
const phasedObjective = phaseTransitionState.specialObjectives["obj-secure-road"];
phasedObjective.progress = 0;
phasedObjective.state = "active";
phasedObjective.currentPhaseIndex = 0;
phasedObjective.phases = [
  { ...createVerifyPhase("verify_phase_recon", "Reconnaitre la route", ["secure_route"], 18), state: "active" },
  createVerifyPhase("verify_phase_hold", "Tenir le passage", ["patrol"], 60)
];
phasedObjective.phaseHistory = [{ phaseId: "verify_phase_recon", enteredAtTick: phaseTransitionState.clock.tick }];
phaseTransitionState.routes["amber-road"].state.ambushRisk = 95;
phaseTransitionState.routes["amber-road"].state.security = 0;
phaseTransitionState.pressures = recomputePressures(phaseTransitionState);
const phaseTransitionOutput = runWorldHours(phaseTransitionState, 1);
assert(
  phasedObjective.currentPhaseIndex === 1,
  `La completion d'une phase devrait activer la phase suivante, index=${phasedObjective.currentPhaseIndex}`
);
assert(
  phasedObjective.phases[0].state === "completed" && phasedObjective.phases[1].state === "active",
  "La premiere phase devrait etre completed et la seconde active"
);
assert(
  phasedObjective.phaseHistory.some(entry => entry.phaseId === "verify_phase_recon" && entry.outcome === "advanced") &&
    phasedObjective.phaseHistory.some(entry => entry.phaseId === "verify_phase_hold" && typeof entry.exitedAtTick !== "number"),
  "L'historique de phase devrait tracer la sortie de l'ancienne phase et l'entree de la suivante"
);
assert(
  phaseTransitionOutput.trace?.phaseTransitions.some(transition => transition.objectiveId === "obj-secure-road" && transition.transition === "completed") &&
    phaseTransitionOutput.trace?.phaseTransitions.some(transition => transition.objectiveId === "obj-secure-road" && transition.transition === "activated"),
  "La trace runtime devrait exposer les transitions de phase completed et activated"
);

const mobileArrivalState = createExampleWorldState();
const arrivalConvoy = mobileArrivalState.mobileActors["mobile-convoy"];
const arrivalRoute = mobileArrivalState.routes["amber-road"];
const arrivalObjective = mobileArrivalState.specialObjectives["obj-secure-road"];
const valecroftSupplyBeforeArrival = mobileArrivalState.cities.valecroft.state.supply ?? 0;
const objectiveProgressBeforeArrival = arrivalObjective.progress;
arrivalRoute.state.ambushRisk = 0;
arrivalRoute.state.materialState = 100;
arrivalRoute.state.security = 80;
arrivalConvoy.position = { kind: "route", id: "amber-road" };
arrivalConvoy.destination = { kind: "city", id: "valecroft" };
arrivalConvoy.itinerary = ["amber-road"];
arrivalConvoy.routeProgress = 999;
arrivalConvoy.currentRouteTargetId = "valecroft";
arrivalConvoy.state.fatigue = 0;
arrivalConvoy.state.security = 58;
arrivalConvoy.state.cargo = 61;
const mobileArrivalOutput = runWorldHours(mobileArrivalState, 1);
const mobileArrivalEvent = mobileArrivalOutput.events.find(
  event => event.type === "mobile_actor_arrived" && event.actor.id === "mobile-convoy"
);

assert(Boolean(mobileArrivalEvent), "Un mobile proche de sa destination devrait produire un evenement d'arrivee");
assert(
  mobileArrivalOutput.deltas.some(delta => delta.meta?.kind === "mobile_arrival" && delta.target.kind === "city" && delta.target.id === "valecroft"),
  "L'arrivee d'un mobile devrait appliquer des effets systemiques sur la destination"
);
assert(
  (mobileArrivalState.cities.valecroft.state.supply ?? 0) > valecroftSupplyBeforeArrival,
  "Un convoi charge devrait ameliorer l'approvisionnement de la ville a l'arrivee"
);
assert(
  mobileArrivalState.specialObjectives["obj-secure-road"].progress > objectiveProgressBeforeArrival,
  "L'arrivee du mobile devrait faire progresser son objectif principal"
);
assert(
  mobileArrivalState.mobileActors["mobile-convoy"].recentHistory.some(entry => entry.type === "mobile_arrival_effect"),
  "L'effet d'arrivee du mobile devrait etre historise sur le mobile"
);
assert(
  mobileArrivalState.mobileActors["mobile-convoy"].recentHistory.some(entry => entry.type === "mobile_local_reaction"),
  "L'arrivee d'un mobile devrait provoquer une reaction locale historisee"
);
assert(
  mobileArrivalState.factions["faction-guild"].recentHistory.some(entry => entry.type === "relation_shift" && entry.summary.includes("mobile_local_support")),
  "Une faction locale devrait reagir relationnellement a l'arrivee du mobile"
);

const mobileEncounterState = createExampleWorldState();
Object.values(mobileEncounterState.factions).forEach(faction => {
  faction.objectives = [];
  faction.cooldowns.secure_route = 99;
});
mobileEncounterState.routes["amber-road"].travelCost = 30;
mobileEncounterState.routes["amber-road"].state.ambushRisk = 20;
mobileEncounterState.routes["amber-road"].state.materialState = 100;
mobileEncounterState.routes["amber-road"].state.security = 45;
const militiaColumn = mobileEncounterState.mobileActors["mobile-convoy"];
militiaColumn.position = { kind: "route", id: "amber-road" };
militiaColumn.destination = { kind: "city", id: "stonewatch" };
militiaColumn.itinerary = ["amber-road"];
militiaColumn.currentRouteTargetId = "stonewatch";
militiaColumn.routeProgress = 0;
militiaColumn.speed = 1;
militiaColumn.state.fatigue = 90;
militiaColumn.state.security = 64;
militiaColumn.possibleInteractionTags = ["patrouille", "securite"];
const smugglerBand: MobileActor = {
  id: "mobile-smugglers",
  typeEntity: "smuggler_band",
  mobile: true,
  owner: { kind: "faction", id: "faction-guild" },
  position: { kind: "route", id: "amber-road" },
  destination: { kind: "city", id: "valecroft" },
  itinerary: ["amber-road"],
  travelMode: "road",
  speed: 1,
  routeProgress: 0,
  currentRouteTargetId: "valecroft",
  state: {
    security: 28,
    fatigue: 90,
    cargo: 30,
    headcount: 12,
    resources: 10
  },
  objectives: [],
  possibleInteractionTags: ["criminel", "contrebandiers"],
  recentHistory: [],
  simulationLevel: "active",
  cooldowns: {}
};
mobileEncounterState.mobileActors[smugglerBand.id] = smugglerBand;
const encounterHostilityBefore = mobileEncounterState.factions["faction-militia"].relations.find(
  relation => relation.otherFactionId === "faction-guild"
)?.hostility ?? 0;
const encounterOutput = runWorldHours(mobileEncounterState, mobileEncounterState.clock.microPerMacro);
const encounterHostilityAfter = mobileEncounterState.factions["faction-militia"].relations.find(
  relation => relation.otherFactionId === "faction-guild"
)?.hostility ?? 0;
assert(
  encounterOutput.events.some(event => event.type === "mobile_actor_encounter"),
  "Deux mobiles rivaux sur une meme route devraient produire une rencontre"
);
assert(
  mobileEncounterState.routes["amber-road"].recentHistory.some(entry => entry.type === "mobile_encounter"),
  "Une rencontre mobile devrait etre historisee sur la route"
);
assert(
  encounterHostilityAfter > encounterHostilityBefore,
  "Une rencontre hostile entre mobiles devrait tendre les relations de leurs factions"
);

const offRouteState = createExampleWorldState();
offRouteState.regions.wilds = {
  id: "wilds",
  name: "Wilds",
  cityIds: [],
  mainRouteIds: [],
  state: {
    stability: 35,
    politicalControl: 20,
    production: 35,
    circulation: 20,
    externalThreat: 45
  },
  dominantWeather: "rainy",
  recentHistory: [],
  activeTensionIds: [],
  tags: ["forestier"]
};
Object.values(offRouteState.factions).forEach(faction => {
  faction.objectives = [];
});
const offRouteScout = offRouteState.mobileActors["mobile-convoy"];
offRouteScout.owner = undefined;
offRouteScout.position = { kind: "city", id: "valecroft" };
offRouteScout.destination = { kind: "region", id: "wilds" };
offRouteScout.itinerary = [];
offRouteScout.travelMode = "foot";
offRouteScout.modeTransport = "pied";
offRouteScout.routeProgress = 0;
offRouteScout.speed = 80;
offRouteScout.state.fatigue = 0;
offRouteScout.state.cargo = 0;
const offRouteOutput = runWorldHours(offRouteState, 1);
assert(
  offRouteOutput.trace?.mobility.some(entry => entry.actorId === "mobile-convoy" && entry.outcome === "progress" && entry.notes.some(note => note.includes("hors-route"))),
  "Un mobile sans route disponible devrait pouvoir progresser hors-route"
);
assert(
  offRouteState.mobileActors["mobile-convoy"].routeProgress > 0,
  "La progression hors-route devrait utiliser la progression runtime du mobile"
);

const waterBlockedState = createExampleWorldState();
waterBlockedState.regions.wilds = {
  id: "wilds",
  name: "Wilds",
  cityIds: [],
  mainRouteIds: [],
  state: {
    stability: 35,
    politicalControl: 20,
    production: 35,
    circulation: 20,
    externalThreat: 45
  },
  dominantWeather: "rainy",
  recentHistory: [],
  activeTensionIds: [],
  tags: ["forestier"]
};
Object.values(waterBlockedState.factions).forEach(faction => {
  faction.objectives = [];
});
const boatless = waterBlockedState.mobileActors["mobile-convoy"];
boatless.owner = undefined;
boatless.position = { kind: "city", id: "valecroft" };
boatless.destination = { kind: "region", id: "wilds" };
boatless.itinerary = [];
boatless.travelMode = "river";
boatless.modeTransport = "bateau";
boatless.routeProgress = 0;
boatless.state.fatigue = 0;
const waterBlockedFailureBefore = waterBlockedState.specialObjectives["obj-secure-road"].failureScore;
const waterBlockedOutput = runWorldHours(waterBlockedState, 1);
assert(
  waterBlockedOutput.trace?.mobility.some(entry => entry.actorId === "mobile-convoy" && entry.outcome === "blocked" && entry.notes.some(note => note.includes("navigation impossible"))),
  "Une navigation abstraite sans acces eau devrait rester bloquee"
);
assert(
  waterBlockedState.specialObjectives["obj-secure-road"].failureScore > waterBlockedFailureBefore,
  "Une navigation impossible devrait peser sur l'objectif porte"
);

const riverNetworkState = createExampleWorldState();
riverNetworkState.routes["blue-river"] = {
  id: "blue-river",
  originId: "valecroft",
  destinationId: "greenmarch",
  travelCost: 3,
  length: 4,
  tags: ["river", "waterway", "fluvial"],
  state: {
    security: 55,
    traffic: 35,
    materialState: 70,
    control: 40,
    ambushRisk: 18,
    terrainDifficulty: 4
  },
  recentHistory: [],
  activeTensionIds: [],
  mobileActorIds: []
};
riverNetworkState.cities.valecroft.tags = [...new Set([...riverNetworkState.cities.valecroft.tags, "river"])];
const riverBoat = riverNetworkState.mobileActors["mobile-convoy"];
riverBoat.owner = undefined;
riverBoat.position = { kind: "city", id: "valecroft" };
riverBoat.destination = { kind: "region", id: "greenmarch" };
riverBoat.itinerary = [];
riverBoat.travelMode = "river";
riverBoat.modeTransport = "bateau";
riverBoat.routeProgress = 0;
riverBoat.speed = 40;
riverBoat.state.fatigue = 0;
const riverBoatOutput = runWorldHours(riverNetworkState, 1);
assert(
  riverBoatOutput.trace?.mobility.some(entry => entry.actorId === "mobile-convoy" && entry.routeId === "blue-river" && entry.outcome === "progress"),
  "Un bateau devrait utiliser une route runtime fluviale compatible"
);

const riverByFootState = createExampleWorldState();
riverByFootState.routes["blue-river"] = riverNetworkState.routes["blue-river"];
const riverWalker = riverByFootState.mobileActors["mobile-convoy"];
riverWalker.owner = undefined;
riverWalker.position = { kind: "city", id: "valecroft" };
riverWalker.destination = { kind: "region", id: "greenmarch" };
riverWalker.itinerary = [];
riverWalker.travelMode = "foot";
riverWalker.modeTransport = "pied";
riverWalker.routeProgress = 0;
riverWalker.speed = 80;
riverWalker.state.fatigue = 0;
const riverWalkerOutput = runWorldHours(riverByFootState, 1);
assert(
  riverWalkerOutput.trace?.mobility.some(entry => entry.actorId === "mobile-convoy" && entry.outcome === "progress" && entry.notes.some(note => note.includes("hors-route"))),
  "Un mobile a pied ne devrait pas utiliser une route fluviale comme corridor terrestre"
);

const seaNetworkState = createExampleWorldState();
seaNetworkState.routes["silver-sea-lane"] = {
  id: "silver-sea-lane",
  originId: "valecroft",
  destinationId: "greenmarch",
  travelCost: 4,
  length: 5,
  tags: ["sea", "maritime", "waterway"],
  state: {
    security: 48,
    traffic: 40,
    materialState: 75,
    control: 35,
    ambushRisk: 22,
    terrainDifficulty: 5
  },
  recentHistory: [],
  activeTensionIds: [],
  mobileActorIds: []
};
seaNetworkState.cities.valecroft.tags = [...new Set([...seaNetworkState.cities.valecroft.tags, "maritime"])];
const seaBoat = seaNetworkState.mobileActors["mobile-convoy"];
seaBoat.owner = undefined;
seaBoat.position = { kind: "city", id: "valecroft" };
seaBoat.destination = { kind: "region", id: "greenmarch" };
seaBoat.itinerary = [];
seaBoat.travelMode = "sea";
seaBoat.modeTransport = "bateau";
seaBoat.routeProgress = 0;
seaBoat.speed = 40;
seaBoat.state.fatigue = 0;
const seaBoatOutput = runWorldHours(seaNetworkState, 1);
assert(
  seaBoatOutput.trace?.mobility.some(entry => entry.actorId === "mobile-convoy" && entry.routeId === "silver-sea-lane" && entry.outcome === "progress"),
  "Un bateau devrait utiliser une route maritime runtime compatible"
);

const seaWalkerState = createExampleWorldState();
seaWalkerState.routes["silver-sea-lane"] = seaNetworkState.routes["silver-sea-lane"];
const seaWalker = seaWalkerState.mobileActors["mobile-convoy"];
seaWalker.owner = undefined;
seaWalker.position = { kind: "city", id: "valecroft" };
seaWalker.destination = { kind: "region", id: "greenmarch" };
seaWalker.itinerary = [];
seaWalker.travelMode = "foot";
seaWalker.modeTransport = "pied";
seaWalker.routeProgress = 0;
seaWalker.speed = 80;
seaWalker.state.fatigue = 0;
const seaWalkerOutput = runWorldHours(seaWalkerState, 1);
assert(
  seaWalkerOutput.trace?.mobility.some(entry => entry.actorId === "mobile-convoy" && entry.outcome === "progress" && entry.notes.some(note => note.includes("hors-route"))),
  "Un mobile a pied ne devrait pas utiliser une route maritime comme corridor terrestre"
);

const mobileSetbackState = createExampleWorldState();
const setbackConvoy = mobileSetbackState.mobileActors["mobile-convoy"];
const setbackRoute = mobileSetbackState.routes["amber-road"];
const setbackObjective = mobileSetbackState.specialObjectives["obj-secure-road"];
const setbackFailureBefore = setbackObjective.failureScore;
const setbackSupplyBefore = mobileSetbackState.cities.valecroft.state.supply ?? 0;
Object.values(mobileSetbackState.factions).forEach(faction => {
  faction.objectives = [];
  faction.cooldowns.secure_route = 99;
});
setbackRoute.state.ambushRisk = 100;
setbackRoute.state.materialState = 100;
setbackRoute.state.security = 20;
setbackConvoy.owner = undefined;
setbackConvoy.position = { kind: "route", id: "amber-road" };
setbackConvoy.destination = { kind: "city", id: "valecroft" };
setbackConvoy.itinerary = ["amber-road"];
setbackConvoy.routeProgress = 0;
setbackConvoy.currentRouteTargetId = "valecroft";
setbackConvoy.state.fatigue = 5;
setbackConvoy.state.security = 18;
setbackConvoy.state.cargo = 64;
setbackConvoy.cooldowns.secure_route = 99;
const mobileSetbackOutput = runWorldHours(mobileSetbackState, 1);
const mobileAmbushEvent = mobileSetbackOutput.events.find(
  event => event.type === "mobile_actor_delayed" && event.actor.id === "mobile-convoy" && event.tags.includes("ambush")
);

assert(Boolean(mobileAmbushEvent), "Un mobile charge sur une route tres dangereuse devrait produire une embuscade");
assert(
  mobileSetbackOutput.deltas.some(delta => delta.meta?.kind === "mobile_setback" && delta.meta?.source === "mobile_ambush:mobile-convoy"),
  "L'embuscade mobile devrait appliquer des consequences systemiques"
);
assert(
  mobileSetbackState.specialObjectives["obj-secure-road"].failureScore > setbackFailureBefore,
  "L'embuscade mobile devrait augmenter l'echec de son objectif principal"
);
assert(
  (mobileSetbackState.cities.valecroft.state.supply ?? 0) < setbackSupplyBefore,
  "Le retard d'un convoi charge devrait menacer l'approvisionnement de destination"
);
assert(
  Object.values(mobileSetbackState.tensions).some(
    tension => tension.type === "criminal" && tension.tags.includes("ambush") && tension.targetRefs.some(ref => ref.id === "amber-road")
  ),
  "L'embuscade mobile devrait creer une tension criminelle de route"
);
assert(
  mobileSetbackState.mobileActors["mobile-convoy"].recentHistory.some(entry => entry.type === "mobile_ambush_effect"),
  "L'embuscade mobile devrait etre historisee sur le mobile"
);

console.log("[OK] tension injectee -> index activeTensionIds + historique");
console.log("[OK] macro tick -> tension maintenue dans une competition systeme/opportuniste + deltas systemiques");
console.log("[OK] tension faible -> resolution + nettoyage activeTensionIds");
console.log("[OK] tension de marche -> objectif systeme reopen_market assigne");
console.log("[OK] tension de penurie -> objectif opportuniste criminel + extort");
console.log("[OK] relation hostile -> objectif faction anti-rival");
console.log("[OK] relation de confiance -> objectif cooperatif de corridor");
console.log("[OK] tension de route -> objectif opportuniste militaire");
console.log("[OK] tension de penurie -> objectif opportuniste marchand + action de marche");
console.log("[OK] tension politique locale -> objectif civique + tension_relieved");
console.log("[OK] actions de faction -> relations inter-factions mises a jour");
console.log("[OK] generation mobile -> objectif blocked ignore");
console.log("[OK] generation mobile -> plafond runtime rempli sans double comptage");
console.log("[OK] mobile arrive -> effets destination + progression objectif");
console.log("[OK] mobile arrive -> reaction locale faction/lieu historisee");
console.log("[OK] mobiles rivaux sur route -> rencontre + reaction relationnelle");
console.log("[OK] mobile hors-route -> progression abstraite sans route");
console.log("[OK] mobile bateau -> navigation bloquee sans acces eau");
console.log("[OK] mobile bateau -> route fluviale runtime utilisee");
console.log("[OK] mobile a pied -> route fluviale ignoree comme corridor terrestre");
console.log("[OK] mobile bateau -> route maritime runtime utilisee");
console.log("[OK] mobile a pied -> route maritime ignoree comme corridor terrestre");
console.log("[OK] mobile retarde -> echec objectif + crise route/destination");
console.log("[OK] scenario long -> evenements, deltas, historique et tensions continuent d'evoluer");
console.log("\nVerification world-simulation-cycle reussie.");
