import { findShortestRouteItinerary, getRouteTraversalCost } from "./travel";
import { evaluateObjectiveReadiness, synchronizeObjectiveReadiness } from "./objectiveReadiness";
import type {
  EntityId,
  EntityRef,
  FactionTransportResources,
  LogisticsPlanTrace,
  MobilityRequirement,
  MobileActor,
  SpecialObjective,
  TransportMode,
  WorldFaction,
  WorldState
} from "./types";

function getActiveObjectivePhase(objective: SpecialObjective | undefined) {
  if (!objective || objective.phases.length === 0) return undefined;
  if (objective.currentPhaseIndex < 0 || objective.currentPhaseIndex >= objective.phases.length) return undefined;
  return objective.phases[objective.currentPhaseIndex];
}

function getObjectiveRequirementTarget(objective: SpecialObjective): EntityRef | undefined {
  const activePhase = getActiveObjectivePhase(objective);
  return activePhase?.localTarget ?? objective.target;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function getTopObjectiveForFaction(state: WorldState, faction: WorldFaction): SpecialObjective | undefined {
  return faction.objectives
    .map(goal => state.specialObjectives[goal.objectiveId])
    .filter(
      (objective): objective is SpecialObjective =>
        Boolean(objective) &&
        objective.state !== "completed" &&
        objective.state !== "failed" &&
        evaluateObjectiveReadiness(state, objective).ready
    )
    .sort((left, right) => right.priority - left.priority)[0];
}

function resolveExecutionTarget(state: WorldState, target?: EntityRef): EntityRef | undefined {
  if (!target) return undefined;
  if (target.kind === "district") {
    const district = state.districts[target.id];
    return district ? { kind: "city", id: district.cityId } : undefined;
  }
  if (target.kind === "route") {
    const route = state.routes[target.id];
    if (!route) return undefined;
    return state.cities[route.originId]
      ? { kind: "city", id: route.originId }
      : state.regions[route.originId]
        ? { kind: "region", id: route.originId }
        : undefined;
  }
  if (target.kind === "city" || target.kind === "region") {
    return target;
  }
  return undefined;
}

function deriveMobilityRequirement(objective: SpecialObjective): MobilityRequirement {
  const targetRef = getObjectiveRequirementTarget(objective);
  switch (objective.category) {
    case "search_object":
      return {
        objectifId: objective.id,
        factionId: objective.owner.id,
        categorie: objective.category,
        priorite: objective.priority,
        intention: "discret",
        cibleRef: targetRef,
        besoinCharge: 8,
        besoinEffectif: 6,
        besoinDiscretion: 76,
        besoinVitesse: 60,
        besoinSecurite: 42
      };
    case "open_route":
      return {
        objectifId: objective.id,
        factionId: objective.owner.id,
        categorie: objective.category,
        priorite: objective.priority,
        intention: "escorte",
        cibleRef: targetRef,
        besoinCharge: 20,
        besoinEffectif: 16,
        besoinDiscretion: 20,
        besoinVitesse: 54,
        besoinSecurite: 72
      };
    case "acquire_resource":
      return {
        objectifId: objective.id,
        factionId: objective.owner.id,
        categorie: objective.category,
        priorite: objective.priority,
        intention: "charge",
        cibleRef: targetRef,
        besoinCharge: 42,
        besoinEffectif: 12,
        besoinDiscretion: 24,
        besoinVitesse: 44,
        besoinSecurite: 58
      };
    case "recover_person":
      return {
        objectifId: objective.id,
        factionId: objective.owner.id,
        categorie: objective.category,
        priorite: objective.priority,
        intention: "rapide",
        cibleRef: targetRef,
        besoinCharge: 10,
        besoinEffectif: 8,
        besoinDiscretion: 48,
        besoinVitesse: 76,
        besoinSecurite: 64
      };
    default:
      return {
        objectifId: objective.id,
        factionId: objective.owner.id,
        categorie: objective.category,
        priorite: objective.priority,
        intention: "projection_force",
        cibleRef: targetRef,
        besoinCharge: 14,
        besoinEffectif: 10,
        besoinDiscretion: 28,
        besoinVitesse: 48,
        besoinSecurite: 52
      };
  }
}

function deriveTransportResources(state: WorldState, faction: WorldFaction): FactionTransportResources {
  if (faction.ressourcesTransport) {
    return faction.ressourcesTransport;
  }
  const ownedActors = Object.values(state.mobileActors).filter(actor => actor.owner?.kind === "faction" && actor.owner.id === faction.id);
  const horseAssets = ownedActors.filter(actor => actor.modeTransport === "cheval").length;
  const boatAssets = ownedActors.filter(actor => actor.modeTransport === "bateau").length;
  const tagHorseBonus = faction.tags.some(tag => ["military", "trade", "civic"].includes(tag)) ? 8 : 0;
  const tagBoatBonus = faction.tags.some(tag => ["trade", "maritime"].includes(tag)) ? 2 : 0;
  return {
    budgetTotal: faction.state.resources ?? 0,
    budgetDisponible: faction.state.resources ?? 0,
    chevauxTotal: Math.max(0, Math.round((faction.state.power ?? 0) * 0.25 + horseAssets * 4 + tagHorseBonus)),
    chevauxDisponibles: Math.max(0, Math.round((faction.state.power ?? 0) * 0.25 + horseAssets * 4 + tagHorseBonus)),
    bateauxTotal: Math.max(0, Math.round((faction.state.influence ?? 0) * 0.05 + boatAssets + tagBoatBonus)),
    bateauxDisponibles: Math.max(0, Math.round((faction.state.influence ?? 0) * 0.05 + boatAssets + tagBoatBonus)),
    effectifsTotal: Math.max(0, Math.round((faction.state.power ?? 0) * 0.7 + (faction.state.cohesion ?? 0) * 0.3)),
    effectifsDisponibles: Math.max(0, Math.round((faction.state.power ?? 0) * 0.7 + (faction.state.cohesion ?? 0) * 0.3))
  };
}

export function reinitialiserRessourcesTransport(state: WorldState) {
  Object.values(state.factions).forEach(faction => {
    const ressources = deriveTransportResources(state, faction);
    const budgetCourant = faction.state.resources ?? ressources.budgetTotal;
    ressources.budgetTotal = Math.max(0, Math.round(budgetCourant));
    ressources.budgetDisponible = ressources.budgetTotal;
    ressources.chevauxDisponibles = ressources.chevauxTotal;
    ressources.bateauxDisponibles = ressources.bateauxTotal;
    ressources.effectifsDisponibles = ressources.effectifsTotal;
    faction.ressourcesTransport = ressources;
  });
}

function getModeNetwork(mode: TransportMode): MobileActor["travelMode"] {
  return mode === "bateau" ? "river" : mode === "cheval" ? "road" : "foot";
}

function getModeSpeedMultiplier(mode: TransportMode): number {
  if (mode === "cheval") return 1.3;
  if (mode === "bateau") return 1.2;
  return 1;
}

function computeRouteRisk(state: WorldState, routeIds: EntityId[]): number {
  if (routeIds.length === 0) return 0;
  const total = routeIds.reduce((sum, routeId) => {
    const route = state.routes[routeId];
    if (!route) return sum;
    const military = state.pressures.route?.[routeId]?.military ?? route.state.ambushRisk ?? 0;
    const material = 100 - (route.state.materialState ?? 100);
    return sum + military * 0.65 + material * 0.35;
  }, 0);
  return total / routeIds.length;
}

function estimatePlanCost(requirement: MobilityRequirement, mode: TransportMode, routeCount: number): number {
  const modeBase = mode === "cheval" ? 18 : mode === "bateau" ? 22 : 10;
  return Math.round(
    modeBase +
    requirement.besoinEffectif * 0.6 +
    requirement.besoinCharge * 0.25 +
    routeCount * 2
  );
}

function computeTransportDemand(requirement: MobilityRequirement, mode: TransportMode) {
  const effectifPlanifie = Math.max(4, requirement.besoinEffectif);
  const chargePlanifiee = Math.max(0, requirement.besoinCharge);
  if (mode === "cheval") {
    return {
      effectifPlanifie,
      chargePlanifiee,
      chevauxNecessaires: Math.max(2, Math.ceil((effectifPlanifie + chargePlanifiee * 0.5) / 2)),
      bateauxNecessaires: 0
    };
  }
  if (mode === "bateau") {
    return {
      effectifPlanifie,
      chargePlanifiee,
      chevauxNecessaires: 0,
      bateauxNecessaires: Math.max(1, Math.ceil((effectifPlanifie + chargePlanifiee * 0.5) / 40))
    };
  }
  return {
    effectifPlanifie,
    chargePlanifiee,
    chevauxNecessaires: 0,
    bateauxNecessaires: 0
  };
}

function buildModePlan(
  state: WorldState,
  faction: WorldFaction,
  requirement: MobilityRequirement,
  resources: FactionTransportResources,
  mode: TransportMode
): LogisticsPlanTrace {
  const executionTargetRef = resolveExecutionTarget(state, requirement.cibleRef);
  const existingActor = Object.values(state.mobileActors).find(actor => actor.owner?.kind === "faction" && actor.owner.id === faction.id);
  if (!executionTargetRef || !existingActor) {
    return {
      objectifId: requirement.objectifId,
      factionId: faction.id,
      categorie: requirement.categorie,
      priorite: requirement.priorite,
      cibleExecutionRef: executionTargetRef,
      routeIds: [],
      faisable: false,
      notes: [],
      raisonsBlocage: ["pas_de_cible_execution_ou_mobile"]
    };
  }
  const demandeTransport = computeTransportDemand(requirement, mode);

  const travelActor: MobileActor = {
    ...existingActor,
    position: existingActor.position,
    destination: executionTargetRef,
    modeTransport: mode,
    travelMode: getModeNetwork(mode)
  };
  const routeIds = findShortestRouteItinerary(state, travelActor);
  const routeCost = routeIds.reduce((sum, routeId) => {
    const route = state.routes[routeId];
    return route ? sum + getRouteTraversalCost(route, travelActor) : sum;
  }, 0);
  const estimatedHours = routeIds.length > 0
    ? Math.max(1, Math.ceil(routeCost / Math.max(1, existingActor.speed * getModeSpeedMultiplier(mode))))
    : executionTargetRef.id === existingActor.position.id
      ? 0
      : undefined;
  const estimatedCost = estimatePlanCost(requirement, mode, routeIds.length);
  const riskScore = computeRouteRisk(state, routeIds);
  const raisonsBlocage: string[] = [];

  if (resources.effectifsDisponibles < demandeTransport.effectifPlanifie) {
    raisonsBlocage.push("effectifs_insuffisants");
  }
  if (resources.budgetDisponible < estimatedCost) {
    raisonsBlocage.push("budget_insuffisant");
  }
  if (mode === "cheval" && resources.chevauxDisponibles < demandeTransport.chevauxNecessaires) {
    raisonsBlocage.push("chevaux_insuffisants");
  }
  if (mode === "bateau" && resources.bateauxDisponibles < demandeTransport.bateauxNecessaires) {
    raisonsBlocage.push("pas_de_bateau_disponible");
  }
  if (mode === "bateau" && routeIds.length > 0) {
    raisonsBlocage.push("reseau_fluvial_absent");
  }
  if (mode === "pied" && requirement.besoinCharge >= 28) {
    raisonsBlocage.push("charge_trop_lourde_pour_pied");
  }
  if (estimatedHours === undefined) {
    raisonsBlocage.push("aucun_itineraire");
  }

  const notes = [
    `intention:${requirement.intention}`,
    `effectif:${demandeTransport.effectifPlanifie}`,
    `charge:${demandeTransport.chargePlanifiee}`
  ];
  return {
    objectifId: requirement.objectifId,
    factionId: faction.id,
    categorie: requirement.categorie,
    priorite: requirement.priorite,
    modeRetenu: mode,
    cibleExecutionRef: executionTargetRef,
    routeIds,
    effectifPlanifie: demandeTransport.effectifPlanifie,
    chargePlanifiee: demandeTransport.chargePlanifiee,
    heuresEstimees: estimatedHours,
    coutEstime: estimatedCost,
    scoreRisque: Math.round(riskScore),
    faisable: raisonsBlocage.length === 0,
    notes,
    raisonsBlocage
  };
}

function selectBestPlan(candidates: LogisticsPlanTrace[]): LogisticsPlanTrace {
  return [...candidates].sort((left, right) => {
    if (left.faisable !== right.faisable) {
      return left.faisable ? -1 : 1;
    }
    const leftHours = left.heuresEstimees ?? Number.POSITIVE_INFINITY;
    const rightHours = right.heuresEstimees ?? Number.POSITIVE_INFINITY;
    if (leftHours !== rightHours) return leftHours - rightHours;
    const leftRisk = left.scoreRisque ?? Number.POSITIVE_INFINITY;
    const rightRisk = right.scoreRisque ?? Number.POSITIVE_INFINITY;
    if (leftRisk !== rightRisk) return leftRisk - rightRisk;
    return (left.coutEstime ?? Number.POSITIVE_INFINITY) - (right.coutEstime ?? Number.POSITIVE_INFINITY);
  })[0];
}

function getAssignableActor(state: WorldState, factionId: EntityId, objectifId: EntityId): MobileActor | undefined {
  return Object.values(state.mobileActors)
    .filter(actor => actor.owner?.kind === "faction" && actor.owner.id === factionId && actor.simulationLevel !== "abstract")
    .sort((left, right) => {
      const leftMatch = left.objectives.some(goal => goal.objectiveId === objectifId) ? 1 : 0;
      const rightMatch = right.objectives.some(goal => goal.objectiveId === objectifId) ? 1 : 0;
      if (leftMatch !== rightMatch) return rightMatch - leftMatch;
      const leftIdle = left.destination ? 0 : 1;
      const rightIdle = right.destination ? 0 : 1;
      return rightIdle - leftIdle;
    })[0];
}

export function buildFactionLogisticsPlans(state: WorldState): LogisticsPlanTrace[] {
  synchronizeObjectiveReadiness(state);
  return Object.values(state.factions)
    .map(faction => {
      const objective = getTopObjectiveForFaction(state, faction);
      if (!objective) return undefined;
      const requirement = deriveMobilityRequirement(objective);
      const resources = deriveTransportResources(state, faction);
      const candidates = [
        buildModePlan(state, faction, requirement, resources, "pied"),
        buildModePlan(state, faction, requirement, resources, "cheval"),
        buildModePlan(state, faction, requirement, resources, "bateau")
      ];
      return selectBestPlan(candidates);
    })
    .filter((plan): plan is LogisticsPlanTrace => Boolean(plan));
}

export function applyFactionLogisticsPlans(state: WorldState, plans: LogisticsPlanTrace[]) {
  plans.forEach(plan => {
    if (!plan.faisable || !plan.cibleExecutionRef || !plan.modeRetenu) return;
    const faction = state.factions[plan.factionId];
    const ressources = faction?.ressourcesTransport;
    const actor = getAssignableActor(state, plan.factionId, plan.objectifId);
    if (!actor || !faction || !ressources) return;
    actor.modeTransport = plan.modeRetenu;
    actor.travelMode = getModeNetwork(plan.modeRetenu);
    actor.destination = plan.cibleExecutionRef;
    actor.itinerary = plan.routeIds;
    actor.currentRouteTargetId = undefined;
    actor.destinationRouteProgress = undefined;
    if (typeof plan.effectifPlanifie === "number") {
      actor.state.headcount = plan.effectifPlanifie;
    }
    if (typeof plan.chargePlanifiee === "number") {
      actor.state.cargo = plan.chargePlanifiee;
    }
    if (actor.position.kind !== "route") {
      actor.routeProgress = 0;
    }
    if (!actor.objectives.some(goal => goal.objectiveId === plan.objectifId)) {
      actor.objectives = [{ objectiveId: plan.objectifId, priority: plan.priorite }, ...actor.objectives];
    }
    ressources.budgetDisponible = Math.max(0, ressources.budgetDisponible - (plan.coutEstime ?? 0));
    ressources.effectifsDisponibles = Math.max(0, ressources.effectifsDisponibles - (plan.effectifPlanifie ?? 0));
    if (plan.modeRetenu === "cheval") {
      const chevauxNecessaires = Math.max(2, Math.ceil(((plan.effectifPlanifie ?? 0) + (plan.chargePlanifiee ?? 0) * 0.5) / 2));
      ressources.chevauxDisponibles = Math.max(0, ressources.chevauxDisponibles - chevauxNecessaires);
    }
    if (plan.modeRetenu === "bateau") {
      const bateauxNecessaires = Math.max(1, Math.ceil(((plan.effectifPlanifie ?? 0) + (plan.chargePlanifiee ?? 0) * 0.5) / 40));
      ressources.bateauxDisponibles = Math.max(0, ressources.bateauxDisponibles - bateauxNecessaires);
    }
    const coutOperationnel = Math.round((plan.coutEstime ?? 0) * 0.35);
    faction.state.resources = Math.max(0, (faction.state.resources ?? 0) - coutOperationnel);
    plan.acteurAssigneId = actor.id;
    plan.notes = [...plan.notes, `assigne:${actor.id}`, `cout_operationnel:${coutOperationnel}`];
  });
}
